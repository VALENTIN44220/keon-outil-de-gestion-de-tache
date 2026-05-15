import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ─────────────────────────────────────────
    // Auth
    // ─────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    const anonKey = (Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();
    const syncSecret = (req.headers.get("x-sync-secret") ?? "").trim();
    const expectedSyncSecret = (Deno.env.get("SYNC_SECRET") ?? "").trim();

    const authorizedByAnonKey = !!token && !!anonKey && token === anonKey;
    const authorizedBySyncSecret =
      !!syncSecret && !!expectedSyncSecret && syncSecret === expectedSyncSecret;

    // Double security: require BOTH anon/publishable bearer and sync secret.
    if (!authorizedByAnonKey || !authorizedBySyncSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin         = createClient(SUPABASE_URL, SERVICE_ROLE);

    // ─────────────────────────────────────────
    // Parsing body
    // ─────────────────────────────────────────
    const body        = await req.json();
    const table       = body?.table       as string;
    const conflictKey = body?.conflict_key as string;
    const records     = body?.records     as unknown[];
    const onConflict  = (body?.on_conflict as string | undefined) ?? "upsert";

    if (!table || !conflictKey || !Array.isArray(records)) {
      return new Response(
        JSON.stringify({
          error: "Bad request",
          expected: { table: "xxx", conflict_key: "col", records: [], on_conflict: "ignore|update_nulls|upsert" },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─────────────────────────────────────────
    // Validation table (datalake_table_catalog)
    // ─────────────────────────────────────────
    const { data: allowedTable, error: catalogError } = await admin
      .from("datalake_table_catalog")
      .select("table_name")
      .eq("table_name", table)
      .eq("sync_enabled", true)
      .maybeSingle();

    if (catalogError || !allowedTable) {
      return new Response(JSON.stringify({ error: "Table not allowed for sync" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────
    // Validation conflict_key
    // ─────────────────────────────────────────
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*(,[a-zA-Z_][a-zA-Z0-9_]*)*$/.test(conflictKey)) {
      return new Response(JSON.stringify({ error: "Invalid conflict_key format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────
    // Limite batch
    // ─────────────────────────────────────────
    if (records.length > 5000) {
      return new Response(JSON.stringify({ error: "Batch size exceeds limit of 5000 records" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────
    // Upsert selon le mode
    //
    // "ignore"       → ON CONFLICT DO NOTHING
    //                  Les enregistrements existants ne sont jamais modifiés.
    //
    // "update_nulls" → ON CONFLICT DO UPDATE uniquement sur les champs NULL
    //                  Les valeurs saisies dans Lovable sont protégées.
    //                  Les champs NULL sont complétés avec les nouvelles valeurs.
    //
    // "upsert"       → Upsert total (comportement par défaut Supabase)
    //                  Écrase toutes les valeurs existantes.
    // ─────────────────────────────────────────
    let upsertError: any = null;

    if (onConflict === "ignore") {
      // ── Mode IGNORE : ON CONFLICT DO NOTHING ──
      const { error } = await admin.from(table).upsert(
        (records as any[]).map((r: any) => r.id ? r : { id: crypto.randomUUID(), ...r }),
        { onConflict: conflictKey, ignoreDuplicates: true },
      );
      upsertError = error;

    } else if (onConflict === "update_nulls") {
      // ── Mode UPDATE_NULLS : combler les champs NULL sans écraser Lovable ──

      // 1) Récupérer les enregistrements existants pour les tiers concernés
      const keys = (records as any[]).map((r) => r[conflictKey]).filter(Boolean);

      const { data: existingRows, error: fetchError } = await admin
        .from(table)
        .select("*")
        .in(conflictKey, keys);

      if (fetchError) {
        console.error("Fetch error (update_nulls):", JSON.stringify(fetchError));
        return new Response(JSON.stringify({ error: "Failed to fetch existing rows" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 2) Map tiers → enregistrement existant
      const existingMap = new Map(
        (existingRows ?? []).map((r: any) => [r[conflictKey], r])
      );

      // 3) Fusion : pour chaque enregistrement entrant,
      //    conserver la valeur existante si non NULL/vide,
      //    sinon prendre la nouvelle valeur
      const merged = (records as any[]).map((newRec: any) => {
        const current = existingMap.get(newRec[conflictKey]);
        if (!current) {
          // Nouveau fournisseur → insert complet (id généré côté edge pour éviter null value in column "id")
          return { id: crypto.randomUUID(), ...newRec };
        }
        const result: any = { ...newRec };
        for (const key of Object.keys(current)) {
          const existingVal = current[key];
          const isProtected =
            existingVal !== null &&
            existingVal !== undefined &&
            existingVal !== "";
          if (isProtected) {
            // Valeur existante dans Lovable → on protège
            result[key] = existingVal;
          }
          // Sinon : champ NULL/vide → on garde la nouvelle valeur (newRec[key])
        }
        return result;
      });

      // 4) Upsert avec les données fusionnées
      const { error } = await admin.from(table).upsert(merged, {
        onConflict: conflictKey,
        ignoreDuplicates: false,
      });
      upsertError = error;

    } else {
      // ── Mode UPSERT total (défaut) ──
      const { error } = await admin.from(table).upsert(
        (records as any[]).map((r: any) => r.id ? r : { id: crypto.randomUUID(), ...r }),
        { onConflict: conflictKey, ignoreDuplicates: false },
      );
      upsertError = error;
    }

    if (upsertError) {
      console.error("Upsert error:", JSON.stringify(upsertError));
      return new Response(JSON.stringify({ error: "Upsert failed", detail: upsertError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, upserted: records.length, mode: onConflict }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (e) {
    console.error("Internal error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
