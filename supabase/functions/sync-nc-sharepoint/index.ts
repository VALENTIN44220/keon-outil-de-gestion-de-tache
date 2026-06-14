// sync-nc-sharepoint — Import (lecture) de la liste SharePoint "QUALITE_NC-AC"
// vers la table nc_declarations.
//
// ÉTAT : PHASE B (préparation). Sens UNIQUE SharePoint -> app pour l'instant.
// L'écriture app -> SharePoint (bidirectionnel) nécessitera le scope Graph
// `Sites.ReadWrite.All` (consentement admin Azure AD) et une règle de conflit.
//
// Activation (rien ne tourne tant que ce n'est pas configuré) :
//   1. Azure AD : accorder à l'app la permission APPLICATION `Sites.Read.All`
//      (puis `Sites.ReadWrite.All` pour la phase bidirectionnelle) + consentement admin.
//   2. Secrets de la fonction :
//        AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET   (déjà présents)
//        SHAREPOINT_SITE_ID   = ex. "keongroup.sharepoint.com,<guid>,<guid>"
//        SHAREPOINT_NC_LIST_ID = GUID de la liste QUALITE_NC-AC
//   3. Invoquer la fonction (manuellement ou via cron). `?dryRun=1` = aucune écriture DB.
//
// Appariement : nc_declarations.sharepoint_item_id = id de l'item SharePoint
// (colonnes ajoutées par la migration nc_004_sharepoint_sync_columns).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mapping : nom AFFICHÉ de la colonne SharePoint -> colonne nc_declarations.
// (Le nom interne Graph est résolu dynamiquement via /columns ; on raisonne
//  sur les libellés visibles, stables et connus du CSV d'export.)
const FIELD_MAP: Record<string, string> = {
  "DATE DU CONSTAT": "date_constat",
  "Nom du processus": "processus_code",
  "ETAT DE LA NC": "status",
  "Intitulé de la Non conformité": "title",
  "SOCIETE": "societe_code",
  "CODE PROJET / ANNEE": "code_projet",
  "Identification": "identification",
  "METIER": "metier_code",
  "Nom du fournisseur (Si NC Fournisseur ou Audit)": "fournisseur_nom",
  "Quel est le problème ? quelle est la situation ?": "description_problem",
  "Apparition possible sur d'autre site/pièce?": "apparition_ailleurs",
  "Déterminer les causes racines prépondérantes dans la création du problème": "causes_racines",
  "Action corrective": "actions_correctives",
  "Action préventive ": "actions_preventives",
  "Efficacité de l'action": "efficacite_action",
  "Date de clôture souhaitée": "date_cloture_souhaitee",
};
// Colonnes "personnes" (emails) à résoudre vers profiles.id.
const PEOPLE_MAP: Record<string, string> = {
  "Rédacteur": "declarant_id",
  "PILOTE DE LA NC": "pilote_id",
};

// Normalisation des libellés -> valeurs contraintes par les CHECK de la table.
const IDENTIFICATION: Record<string, string> = {
  "points de vigilance": "points_vigilance",
  "non-conformité qualité": "nc_qualite",
  "axe d'amélioration": "axe_amelioration",
  "non-conformité fournisseur": "nc_fournisseur",
  "incident site": "incident_site",
};
const APPARITION: Record<string, string> = {
  "oui": "oui", "non": "non", "ne sais pas": "ne_sais_pas", "non concerné": "non_concerne",
};
const STATUS: Record<string, string> = {
  "nouvelle": "nouvelle", "affectée": "affectee", "en cours": "en_cours", "clôturée": "cloturee",
};
const EFFICACITE: Record<string, string> = {
  "efficace": "efficace", "à améliorer": "a_ameliorer", "inefficace": "inefficace",
};

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
const dateOnly = (s: unknown) => (s ? String(s).slice(0, 10) : null);

async function getAppToken(tenant: string, clientId: string, secret: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: secret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
  });
  if (!res.ok) throw new Error(`Token Graph: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

async function graphAll(url: string, token: string): Promise<any[]> {
  const out: any[] = [];
  let next: string | null = url;
  while (next) {
    const res = await fetch(next, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Graph ${res.status}: ${await res.text()}`);
    const json = await res.json();
    out.push(...(json.value ?? []));
    next = json["@odata.nextLink"] ?? null;
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const tenant = Deno.env.get("AZURE_TENANT_ID");
    const clientId = Deno.env.get("AZURE_CLIENT_ID");
    const secret = Deno.env.get("AZURE_CLIENT_SECRET");
    const siteId = Deno.env.get("SHAREPOINT_SITE_ID");
    const listId = Deno.env.get("SHAREPOINT_NC_LIST_ID");

    if (!siteId || !listId) {
      return new Response(JSON.stringify({
        configured: false,
        message: "Sync non configurée — définir SHAREPOINT_SITE_ID et SHAREPOINT_NC_LIST_ID (+ permission Graph Sites.Read.All consentie).",
      }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (!tenant || !clientId || !secret) throw new Error("AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET manquants.");

    const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
    const token = await getAppToken(tenant, clientId, secret);

    // 1) Résoudre nom affiché -> nom interne des colonnes.
    const cols = await graphAll(`https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/columns`, token);
    const internalByDisplay = new Map<string, string>();
    for (const c of cols) internalByDisplay.set(c.displayName, c.name);
    const internal = (display: string) => internalByDisplay.get(display) ?? display;

    // 2) Lire les items + leurs champs.
    const items = await graphAll(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?expand=fields&$top=200`, token,
    );

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Annuaire email -> profile.id (l'email est sur auth.users, pas sur profiles).
    const { data: profs } = await supabase.from("profiles").select("id, user_id");
    const { data: authData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailByUserId = new Map<string, string>();
    for (const u of authData?.users ?? []) if (u.email) emailByUserId.set(u.id, norm(u.email));
    const idByEmail = new Map<string, string>();
    for (const p of profs ?? []) {
      const em = (p as any).user_id ? emailByUserId.get((p as any).user_id) : undefined;
      if (em) idByEmail.set(em, (p as any).id);
    }
    const firstEmailToId = (v: unknown) => {
      const email = String(v ?? "").split(";")[0].trim();
      return email ? (idByEmail.get(norm(email)) ?? null) : null;
    };

    const records = items.map((it) => {
      const f = it.fields ?? {};
      const rec: Record<string, unknown> = {
        sharepoint_item_id: String(it.id),
        sharepoint_etag: it.eTag ?? it["@odata.etag"] ?? null,
        sharepoint_synced_at: new Date().toISOString(),
      };
      for (const [display, col] of Object.entries(FIELD_MAP)) {
        const raw = f[internal(display)];
        if (raw === undefined || raw === null || raw === "") continue;
        if (col === "date_constat" || col === "date_cloture_souhaitee") rec[col] = dateOnly(raw);
        else if (col === "identification") rec[col] = IDENTIFICATION[norm(raw)] ?? null;
        else if (col === "apparition_ailleurs") rec[col] = APPARITION[norm(raw)] ?? null;
        else if (col === "status") rec[col] = STATUS[norm(raw)] ?? "nouvelle";
        else if (col === "efficacite_action") rec[col] = EFFICACITE[norm(raw)] ?? null;
        else rec[col] = raw;
      }
      for (const [display, col] of Object.entries(PEOPLE_MAP)) {
        const id = firstEmailToId(f[internal(display)]);
        if (id) rec[col] = id;
      }
      if (!rec.title) rec.title = "(sans intitulé)";
      if (!rec.status) rec.status = "nouvelle";
      if (!rec.date_constat) rec.date_constat = dateOnly(it.createdDateTime) ?? new Date().toISOString().slice(0, 10);
      return rec;
    });

    if (dryRun) {
      return new Response(JSON.stringify({ configured: true, dryRun: true, count: records.length, sample: records.slice(0, 3) }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 3) Upsert (appariement sur sharepoint_item_id).
    const { error } = await supabase.from("nc_declarations").upsert(records, { onConflict: "sharepoint_item_id" });
    if (error) throw error;

    return new Response(JSON.stringify({ configured: true, imported: records.length }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
