import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const syncSecret = req.headers.get("x-sync-secret") ?? "";
    const expected = Deno.env.get("SYNC_SECRET") ?? "";
    if (!expected || syncSecret !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = await req.json();

    const table = body?.table as string;
    const conflictKey = body?.conflict_key as string;
    const records = body?.records as unknown[];

    if (!table || !conflictKey || !Array.isArray(records)) {
      return new Response(
        JSON.stringify({
          error: "Bad request",
          expected: { table: "xxx", conflict_key: "col", records: [] },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate table name: only allow tables registered in datalake_table_catalog
    const { data: allowedTable, error: catalogError } = await admin
      .from("datalake_table_catalog")
      .select("table_name")
      .eq("table_name", table)
      .eq("sync_enabled", true)
      .maybeSingle();

    if (catalogError || !allowedTable) {
      return new Response(
        JSON.stringify({ error: "Table not allowed for sync" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate conflict_key: only allow simple alphanumeric column names
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(conflictKey)) {
      return new Response(
        JSON.stringify({ error: "Invalid conflict_key format" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Limit batch size to prevent abuse
    if (records.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Batch size exceeds limit of 5000 records" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // upsert
    const { error } = await admin
      .from(table)
      .upsert(records, { onConflict: conflictKey });

    if (error) {
      return new Response(JSON.stringify({ error: "Upsert failed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, upserted: records.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
