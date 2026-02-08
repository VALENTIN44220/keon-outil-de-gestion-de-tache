// supabase/functions/fabric-lakehouse-sync/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TABLE_PREFIX = "LOVABLE_APPTASK_";

const ALL_TABLES = [
  "assignment_rules",
  "be_projects",
  "be_request_details",
  "be_request_sub_processes",
  "be_task_labels",
  "categories",
  "collaborator_group_members",
  "collaborator_groups",
  "companies",
  "departments",
  "hierarchy_levels",
  "holidays",
  "job_titles",
  "pending_task_assignments",
  "permission_profile_process_templates",
  "permission_profiles",
  "process_template_visible_companies",
  "process_template_visible_departments",
  "process_templates",
  "profiles",
  "project_view_configs",
  "request_field_values",
  "sub_process_template_visible_companies",
  "sub_process_template_visible_departments",
  "sub_process_templates",
  "subcategories",
  "task_attachments",
  "task_checklists",
  "task_comments",
  "task_template_checklists",
  "task_template_visible_companies",
  "task_template_visible_departments",
  "task_templates",
  "task_validation_levels",
  "tasks",
  "template_custom_fields",
  "template_validation_levels",
  "user_leaves",
  "user_permission_overrides",
  "user_process_template_overrides",
  "user_roles",
  "workflow_branch_instances",
  "workflow_edges",
  "workflow_nodes",
  "workflow_notifications",
  "workflow_runs",
  "workflow_template_versions",
  "workflow_templates",
  "workflow_validation_instances",
  "workload_slots",
  // Suppliers
  "supplier_purchase_enrichment",
  "supplier_purchase_permissions",
];

function getFabricTableName(supabaseTableName: string): string {
  return `${TABLE_PREFIX}${supabaseTableName}`;
}
function getSupabaseTableName(fabricTableName: string): string {
  return fabricTableName.startsWith(TABLE_PREFIX) ? fabricTableName.substring(TABLE_PREFIX.length) : fabricTableName;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}
interface SyncResult {
  table: string;
  fabricTable: string;
  success: boolean;
  rowCount?: number;
  error?: string;
  usedPath?: string;
}

function isGuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}
function lakehouseRootUrl(baseUrl: string, workspaceId: string, lakehouseIdOrName: string): string {
  if (isGuid(workspaceId) && isGuid(lakehouseIdOrName)) return `${baseUrl}/${workspaceId}/${lakehouseIdOrName}`;
  return `${baseUrl}/${workspaceId}/${lakehouseIdOrName}.Lakehouse`;
}

async function getOneLakeToken(): Promise<string> {
  const tenantId = Deno.env.get("AZURE_TENANT_ID");
  const clientId = Deno.env.get("AZURE_CLIENT_ID");
  const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET");
  if (!tenantId || !clientId || !clientSecret) throw new Error("Azure credentials not configured");

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://storage.azure.com/.default",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Token error:", errorText);
    throw new Error(`Failed to get Azure token: ${response.status}`);
  }

  const data: TokenResponse = await response.json();
  return data.access_token;
}

// ---------------- OneLake write helpers (SYNC) ----------------
async function writeFileToOneLake(accessToken: string, filePath: string, contentString: string): Promise<void> {
  const createResponse = await fetch(`${filePath}?resource=file`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Length": "0" },
  });

  if (!createResponse.ok && createResponse.status !== 201 && createResponse.status !== 409) {
    const errorText = await createResponse.text();
    console.error(`Create file error: ${createResponse.status}`, errorText);
    throw new Error(`Failed to create file: ${createResponse.status}`);
  }

  const encoder = new TextEncoder();
  const contentBytes = encoder.encode(contentString);
  const contentLength = contentBytes.length;

  const appendResponse = await fetch(`${filePath}?action=append&position=0`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
      "Content-Length": contentLength.toString(),
    },
    body: contentString,
  });

  if (!appendResponse.ok && appendResponse.status !== 202) {
    const errorText = await appendResponse.text();
    console.error(`Append error: ${appendResponse.status}`, errorText);
    throw new Error(`Failed to append data: ${appendResponse.status}`);
  }

  const flushResponse = await fetch(`${filePath}?action=flush&position=${contentLength}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!flushResponse.ok && flushResponse.status !== 200) {
    const errorText = await flushResponse.text();
    console.error(`Flush error: ${flushResponse.status}`, errorText);
    throw new Error(`Failed to flush file: ${flushResponse.status}`);
  }
}

async function uploadAsCSV(
  accessToken: string,
  workspaceId: string,
  lakehouseId: string,
  fabricTableName: string,
  data: Record<string, unknown>[],
): Promise<number> {
  const root = lakehouseRootUrl("https://onelake.dfs.fabric.microsoft.com", workspaceId, lakehouseId);
  const csvPath = `${root}/Files/${fabricTableName}.csv`;
  if (!data.length) return 0;

  const allKeys = new Set<string>();
  data.forEach((row) => Object.keys(row).forEach((k) => allKeys.add(k)));
  const columns = Array.from(allKeys);

  const csvRows: string[] = [];
  csvRows.push(columns.map((col) => `"${col}"`).join(","));

  for (const row of data) {
    const values = columns.map((col) => {
      const value = (row as Record<string, unknown>)[col];
      if (value === null || value === undefined) return "";
      if (typeof value === "object") return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      if (typeof value === "string") return `"${value.replace(/"/g, '""')}"`;
      return String(value);
    });
    csvRows.push(values.join(","));
  }

  await writeFileToOneLake(accessToken, csvPath, csvRows.join("\n"));
  return data.length;
}

async function uploadAsJSON(
  accessToken: string,
  workspaceId: string,
  lakehouseId: string,
  fabricTableName: string,
  data: Record<string, unknown>[],
): Promise<void> {
  const root = lakehouseRootUrl("https://onelake.dfs.fabric.microsoft.com", workspaceId, lakehouseId);
  const jsonPath = `${root}/Files/${fabricTableName}.json`;
  await writeFileToOneLake(accessToken, jsonPath, JSON.stringify(data, null, 2));
}

async function checkOneLakeAccess(
  accessToken: string,
  workspaceId: string,
  lakehouseId: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const root = lakehouseRootUrl("https://onelake.dfs.fabric.microsoft.com", workspaceId, lakehouseId);
    const listPath = `${root}/Files?resource=filesystem&recursive=false`;

    const resp = await fetch(listPath, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-ms-version": "2021-06-08",
        "x-ms-date": new Date().toUTCString(),
      },
    });

    if (resp.ok || resp.status === 200) return { success: true, message: "OneLake access verified" };

    const errorText = await resp.text();
    return { success: false, message: `Access denied: ${resp.status} - ${errorText}` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { success: false, message: `Connection error: ${msg}` };
  }
}

// ---------------- Import helpers ----------------
function stripUnderscoreColumns(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) if (!k.startsWith("_")) out[k] = v;
  return out;
}

function transformRecord(tableName: string, record: Record<string, unknown>): Record<string, unknown> {
  const r = stripUnderscoreColumns(record);

  if (tableName === "user_leaves") {
    if (r.start_half_day === "AM") r.start_half_day = "morning";
    else if (r.start_half_day === "PM") r.start_half_day = "afternoon";

    if (r.end_half_day === "AM") r.end_half_day = "morning";
    else if (r.end_half_day === "PM") r.end_half_day = "afternoon";

    const leaveTypeMapping: Record<string, string> = {
      "Congés payés": "paid",
      "Congés payés 2024/2025": "paid",
      "Congés payés 2023/2024": "paid",
      "Congés payés 2025/2026": "paid",
      CP: "paid",
      RTT: "rtt",
      "RTT 2024": "rtt",
      "RTT 2025": "rtt",
      Maladie: "sick",
      "Arrêt maladie": "sick",
      "Congé sans solde": "unpaid",
      CSS: "unpaid",
    };

    if (typeof r.leave_type === "string") {
      const lt = r.leave_type;
      if (leaveTypeMapping[lt]) r.leave_type = leaveTypeMapping[lt];
      else {
        const lower = lt.toLowerCase();
        if (lower.includes("congés payés") || lower.includes("cp")) r.leave_type = "paid";
        else if (lower.includes("rtt")) r.leave_type = "rtt";
        else if (lower.includes("maladie") || lower.includes("sick")) r.leave_type = "sick";
        else if (lower.includes("sans solde") || lower.includes("css")) r.leave_type = "unpaid";
        else r.leave_type = "other";
      }
    }

    const statusMapping: Record<string, string> = {
      declared: "declared",
      approved: "declared",
      pending: "declared",
      cancelled: "cancelled",
      rejected: "cancelled",
    };

    if (typeof r.status === "string") {
      const lower = r.status.toLowerCase();
      r.status = statusMapping[lower] || "declared";
    }
  }

  return r;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function upsertBatch(
  supabase: ReturnType<typeof createClient>,
  tableName: string,
  batch: Record<string, unknown>[],
): Promise<{ ok: boolean; error?: string }> {
  if (!batch.length) return { ok: true };

  // supplier_purchase_enrichment: upsert par clé métier "tiers"
  // => nécessite un unique index sur tiers côté Supabase
  const onConflictKey = tableName === "supplier_purchase_enrichment" ? "tiers" : "id";

  const { error } = await supabase.from(tableName).upsert(batch, {
    onConflict: onConflictKey,
    returning: "minimal",
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// NDJSON streaming (safe WORKER_LIMIT)
async function importNdjsonStreaming(
  supabase: ReturnType<typeof createClient>,
  tableName: string,
  fileUrl: string,
  accessToken: string,
): Promise<{ imported: number; failed: boolean; error?: string }> {
  const resp = await fetch(fileUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}`, "x-ms-version": "2021-06-08" },
  });

  if (!resp.ok || !resp.body) {
    const txt = await resp.text().catch(() => "");
    return { imported: 0, failed: true, error: `Failed to read file (${resp.status}): ${txt}` };
  }

  const BATCH_SIZE = tableName === "supplier_purchase_enrichment" ? 25 : 150;

  const decoder = new TextDecoder();
  const reader = resp.body.getReader();

  let buffer = "";
  let batch: Record<string, unknown>[] = [];
  let imported = 0;

  const flush = async (): Promise<{ ok: boolean; error?: string }> => {
    if (!batch.length) return { ok: true };
    const f = await upsertBatch(supabase, tableName, batch);
    if (!f.ok) return f;
    imported += batch.length;
    batch = [];
    await sleep(tableName === "supplier_purchase_enrichment" ? 35 : 10);
    return { ok: true };
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;

      let obj: Record<string, unknown>;
      try {
        obj = JSON.parse(line);
      } catch (e) {
        return { imported, failed: true, error: `Invalid NDJSON line: ${String(e)}` };
      }

      batch.push(transformRecord(tableName, obj));

      if (batch.length >= BATCH_SIZE) {
        const f = await flush();
        if (!f.ok) return { imported, failed: true, error: f.error };
      }
    }
  }

  const last = buffer.trim();
  if (last) {
    try {
      batch.push(transformRecord(tableName, JSON.parse(last)));
    } catch (e) {
      return { imported, failed: true, error: `Invalid NDJSON last line: ${String(e)}` };
    }
  }

  const f = await flush();
  if (!f.ok) return { imported, failed: true, error: f.error };

  return { imported, failed: false };
}

// JSON array fallback (for small tables only)
async function importJsonArrayText(
  supabase: ReturnType<typeof createClient>,
  tableName: string,
  text: string,
): Promise<{ imported: number; failed: boolean; error?: string }> {
  // supplier_purchase_enrichment: tableau JSON interdit (WORKER_LIMIT)
  if (tableName === "supplier_purchase_enrichment") {
    return {
      imported: 0,
      failed: true,
      error:
        "supplier_purchase_enrichment doit être en NDJSON (1 ligne = 1 JSON). Export Fabric en tableau JSON refusé.",
    };
  }

  let records: Record<string, unknown>[];
  try {
    records = JSON.parse(text);
  } catch (e) {
    return { imported: 0, failed: true, error: `Invalid JSON array: ${String(e)}` };
  }

  const BATCH_SIZE = 200;
  let imported = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE).map((r) => transformRecord(tableName, r));
    const f = await upsertBatch(supabase, tableName, batch);
    if (!f.ok) return { imported, failed: true, error: f.error };

    imported += batch.length;
    await sleep(5);
  }

  return { imported, failed: false };
}

async function fetchFileText(
  accessToken: string,
  fileUrl: string,
): Promise<{ ok: boolean; text?: string; error?: string }> {
  const resp = await fetch(fileUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}`, "x-ms-version": "2021-06-08" },
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    return { ok: false, error: `GET failed (${resp.status}): ${t}` };
  }
  const text = await resp.text();
  return { ok: true, text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, tables } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const workspaceId = Deno.env.get("FABRIC_WORKSPACE_ID");
    const lakehouseId = Deno.env.get("FABRIC_LAKEHOUSE_ID");
    if (!workspaceId || !lakehouseId) throw new Error("Fabric Lakehouse credentials not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);

    const accessToken = await getOneLakeToken();

    if (action === "diagnose") {
      const accessCheck = await checkOneLakeAccess(accessToken, workspaceId, lakehouseId);
      return new Response(
        JSON.stringify({
          success: accessCheck.success,
          workspaceId,
          lakehouseId,
          message: accessCheck.message,
          tablesCount: ALL_TABLES.length,
          tablePrefix: TABLE_PREFIX,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "sync") {
      const tablesToSync = tables && tables.length > 0 ? tables : ALL_TABLES;
      const results: SyncResult[] = [];

      for (const tableName of tablesToSync) {
        const fabricTableName = getFabricTableName(tableName);
        try {
          const { data, error } = await supabase.from(tableName).select("*");
          if (error) {
            results.push({ table: tableName, fabricTable: fabricTableName, success: false, error: error.message });
            continue;
          }
          if (!data || !data.length) {
            results.push({ table: tableName, fabricTable: fabricTableName, success: true, rowCount: 0 });
            continue;
          }

          const rowCount = await uploadAsCSV(accessToken, workspaceId, lakehouseId, fabricTableName, data);
          await uploadAsJSON(accessToken, workspaceId, lakehouseId, fabricTableName, data);

          results.push({ table: tableName, fabricTable: fabricTableName, success: true, rowCount });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Unknown error";
          results.push({ table: tableName, fabricTable: fabricTableName, success: false, error: msg });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const totalRows = results.reduce((sum, r) => sum + (r.rowCount || 0), 0);

      return new Response(
        JSON.stringify({
          success: successCount === results.length,
          syncedTables: successCount,
          totalTables: results.length,
          totalRows,
          tablePrefix: TABLE_PREFIX,
          results,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "preview") {
      const tablesToSync = tables && tables.length > 0 ? tables : ALL_TABLES;
      const preview = [];

      for (const tableName of tablesToSync) {
        const { count, error } = await supabase.from(tableName).select("*", { count: "exact", head: true });
        preview.push({
          table: tableName,
          fabricTable: getFabricTableName(tableName),
          rowCount: error ? 0 : count || 0,
          error: error?.message,
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          tables: preview,
          totalRows: preview.reduce((sum, t) => sum + t.rowCount, 0),
          tablePrefix: TABLE_PREFIX,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "import") {
      const tablesToImport = tables && tables.length > 0 ? tables : ALL_TABLES;
      const results: SyncResult[] = [];
      const syncBackPath = `${lakehouseRootUrl("https://onelake.dfs.fabric.microsoft.com", workspaceId, lakehouseId)}/Files/_sync_back`;

      for (const inputName of tablesToImport) {
        const tableName = inputName.startsWith(TABLE_PREFIX) ? getSupabaseTableName(inputName) : inputName;
        const fabricTableName = getFabricTableName(tableName);

        try {
          const possibleFiles = [`${syncBackPath}/${fabricTableName}.json`, `${syncBackPath}/${tableName}.json`];

          let usedPath = "";
          let found = false;

          for (const filePath of possibleFiles) {
            const head = await fetch(`${filePath}?action=getStatus`, {
              method: "HEAD",
              headers: { Authorization: `Bearer ${accessToken}`, "x-ms-version": "2021-06-08" },
            });
            if (head.ok || head.status === 200) {
              usedPath = filePath;
              found = true;
              break;
            }
          }

          if (!found) {
            results.push({ table: tableName, fabricTable: fabricTableName, success: true, rowCount: 0 });
            continue;
          }

          // Décider format: NDJSON (preferred) vs JSON array
          // - supplier_purchase_enrichment: NDJSON obligatoire
          // - autres: auto (si ça commence par '[' => JSON array)
          const peek = await fetchFileText(accessToken, usedPath);
          if (!peek.ok || !peek.text) {
            results.push({
              table: tableName,
              fabricTable: fabricTableName,
              success: false,
              rowCount: 0,
              error: peek.error ?? "Unable to read file",
              usedPath,
            });
            continue;
          }

          const trimmed = peek.text.trim();

          let out: { imported: number; failed: boolean; error?: string };

          if (trimmed.startsWith("[")) {
            out = await importJsonArrayText(supabase, tableName, trimmed);
          } else {
            // NDJSON (streaming) => re-fetch in streaming mode
            out = await importNdjsonStreaming(supabase, tableName, usedPath, accessToken);
          }

          results.push({
            table: tableName,
            fabricTable: fabricTableName,
            success: !out.failed,
            rowCount: out.imported,
            error: out.error,
            usedPath,
          });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Unknown error";
          results.push({ table: tableName, fabricTable: fabricTableName, success: false, error: msg });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const totalRows = results.reduce((sum, r) => sum + (r.rowCount || 0), 0);
      const importedTables = results.filter((r) => r.success && (r.rowCount || 0) > 0).length;

      return new Response(
        JSON.stringify({
          success: successCount === results.length,
          importedTables,
          totalTables: results.length,
          totalRows,
          tablePrefix: TABLE_PREFIX,
          results,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "list-import-files") {
      const root = lakehouseRootUrl("https://onelake.dfs.fabric.microsoft.com", workspaceId, lakehouseId);
      const syncBackPath = `${root}/Files/_sync_back`;

      try {
        const files: string[] = [];

        for (const tableName of ALL_TABLES) {
          const prefixed = getFabricTableName(tableName);
          const candidates = [`${syncBackPath}/${prefixed}.json`, `${syncBackPath}/${tableName}.json`];

          let found: string | null = null;
          for (const candidatePath of candidates) {
            const head = await fetch(`${candidatePath}?action=getStatus`, {
              method: "HEAD",
              headers: { Authorization: `Bearer ${accessToken}`, "x-ms-version": "2021-06-08" },
            });
            if (head.ok || head.status === 200) {
              found = candidatePath.endsWith(`/${prefixed}.json`) ? prefixed : tableName;
              break;
            }
          }
          if (found) files.push(found);
        }

        return new Response(
          JSON.stringify({
            success: true,
            files,
            message:
              files.length > 0
                ? `${files.length} fichier(s) trouvé(s) pour import (Files/_sync_back)`
                : "Aucun fichier JSON trouvé dans Files/_sync_back.",
            tablePrefix: TABLE_PREFIX,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        return new Response(JSON.stringify({ success: false, files: [], error: msg, tablePrefix: TABLE_PREFIX }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Fabric Lakehouse sync error:", error);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
