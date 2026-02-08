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
  if (isGuid(workspaceId) && isGuid(lakehouseIdOrName)) {
    return `${baseUrl}/${workspaceId}/${lakehouseIdOrName}`;
  }
  return `${baseUrl}/${workspaceId}/${lakehouseIdOrName}.Lakehouse`;
}

async function getOneLakeToken(): Promise<string> {
  const tenantId = Deno.env.get("AZURE_TENANT_ID");
  const clientId = Deno.env.get("AZURE_CLIENT_ID");
  const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET");

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Azure credentials not configured");
  }

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

// Helper to create/overwrite a file in OneLake
async function writeFileToOneLake(accessToken: string, filePath: string, contentString: string): Promise<void> {
  // Create file
  const createResponse = await fetch(`${filePath}?resource=file`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Length": "0",
    },
  });

  if (!createResponse.ok && createResponse.status !== 201 && createResponse.status !== 409) {
    const errorText = await createResponse.text();
    console.error(`Create file error: ${createResponse.status}`, errorText);
    throw new Error(`Failed to create file: ${createResponse.status}`);
  }

  // Get content length in bytes (important for UTF-8 characters)
  const encoder = new TextEncoder();
  const contentBytes = encoder.encode(contentString);
  const contentLength = contentBytes.length;

  // Append content
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

  // Flush
  const flushResponse = await fetch(`${filePath}?action=flush&position=${contentLength}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
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
  const baseUrl = "https://onelake.dfs.fabric.microsoft.com";
  const root = lakehouseRootUrl(baseUrl, workspaceId, lakehouseId);

  const csvPath = `${root}/Files/${fabricTableName}.csv`;
  if (data.length === 0) return 0;

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

  const csvContent = csvRows.join("\n");
  console.log(`Uploading CSV to: ${csvPath} (${data.length} rows)`);
  await writeFileToOneLake(accessToken, csvPath, csvContent);
  return data.length;
}

async function uploadAsJSON(
  accessToken: string,
  workspaceId: string,
  lakehouseId: string,
  fabricTableName: string,
  data: Record<string, unknown>[],
): Promise<void> {
  const baseUrl = "https://onelake.dfs.fabric.microsoft.com";
  const root = lakehouseRootUrl(baseUrl, workspaceId, lakehouseId);

  const jsonPath = `${root}/Files/${fabricTableName}.json`;
  const jsonContent = JSON.stringify(data, null, 2);

  console.log(`Uploading JSON to: ${jsonPath}`);
  await writeFileToOneLake(accessToken, jsonPath, jsonContent);
}

async function checkOneLakeAccess(
  accessToken: string,
  workspaceId: string,
  lakehouseId: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const baseUrl = "https://onelake.dfs.fabric.microsoft.com";
    const root = lakehouseRootUrl(baseUrl, workspaceId, lakehouseId);

    const listPath = `${root}/Files?resource=filesystem&recursive=false`;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "x-ms-version": "2021-06-08",
      "x-ms-date": new Date().toUTCString(),
    };

    console.log(`Checking OneLake access at: ${listPath}`);

    const resp = await fetch(listPath, {
      method: "GET",
      headers,
    });

    console.log(`OneLake response status: ${resp.status}`);

    if (resp.ok || resp.status === 200) {
      return { success: true, message: "OneLake access verified" };
    } else {
      const errorText = await resp.text();
      console.error(`OneLake access error: ${errorText}`);
      return { success: false, message: `Access denied: ${resp.status} - ${errorText}` };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Connection error: ${errorMessage}` };
  }
}

function stripUnderscoreColumns(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (!k.startsWith("_")) out[k] = v;
  }
  return out;
}

function transformRecord(tableName: string, record: Record<string, unknown>): Record<string, unknown> {
  const transformed = stripUnderscoreColumns(record);

  if (tableName === "user_leaves") {
    // Map half_day values: AM -> morning, PM -> afternoon
    if (transformed.start_half_day === "AM") transformed.start_half_day = "morning";
    else if (transformed.start_half_day === "PM") transformed.start_half_day = "afternoon";

    if (transformed.end_half_day === "AM") transformed.end_half_day = "morning";
    else if (transformed.end_half_day === "PM") transformed.end_half_day = "afternoon";

    // Map leave_type values
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

    if (typeof transformed.leave_type === "string") {
      const lt = transformed.leave_type;
      if (leaveTypeMapping[lt]) transformed.leave_type = leaveTypeMapping[lt];
      else {
        const lowerType = lt.toLowerCase();
        if (lowerType.includes("congés payés") || lowerType.includes("cp")) transformed.leave_type = "paid";
        else if (lowerType.includes("rtt")) transformed.leave_type = "rtt";
        else if (lowerType.includes("maladie") || lowerType.includes("sick")) transformed.leave_type = "sick";
        else if (lowerType.includes("sans solde") || lowerType.includes("css")) transformed.leave_type = "unpaid";
        else transformed.leave_type = "other";
      }
    }

    // Map status if needed
    const statusMapping: Record<string, string> = {
      declared: "declared",
      approved: "declared",
      pending: "declared",
      cancelled: "cancelled",
      rejected: "cancelled",
    };

    if (typeof transformed.status === "string") {
      const lowerStatus = transformed.status.toLowerCase();
      transformed.status = statusMapping[lowerStatus] || "declared";
    }
  }

  return transformed;
}

// --- Stream NDJSON from fetch response, micro-batch upserts (WORKER_LIMIT safe)
async function importNdjsonStreaming(
  supabase: ReturnType<typeof createClient>,
  tableName: string,
  fileUrl: string,
  accessToken: string,
): Promise<{ imported: number; failed: boolean; error?: string }> {
  const resp = await fetch(fileUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "x-ms-version": "2021-06-08",
    },
  });

  if (!resp.ok || !resp.body) {
    const txt = await resp.text().catch(() => "");
    return { imported: 0, failed: true, error: `Failed to read file (${resp.status}): ${txt}` };
  }

  // Very small batches for supplier_purchase_enrichment to avoid WORKER_LIMIT
  const BATCH_SIZE = tableName === "supplier_purchase_enrichment" ? 25 : 150;
  const decoder = new TextDecoder();
  const reader = resp.body.getReader();

  let buffer = "";
  let batch: Record<string, unknown>[] = [];
  let imported = 0;

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const flush = async (): Promise<{ ok: boolean; error?: string }> => {
    if (batch.length === 0) return { ok: true };

    // Upsert key: tiers for supplier_purchase_enrichment (recommended), id otherwise.
    const onConflictKey = tableName === "supplier_purchase_enrichment" ? "tiers" : "id";

    const { error } = await supabase.from(tableName).upsert(batch, {
      onConflict: onConflictKey,
      returning: "minimal",
    });

    if (error) return { ok: false, error: error.message };

    imported += batch.length;
    batch = [];

    // yield to reduce CPU spikes
    await sleep(25);
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

  // last chunk (no newline)
  const last = buffer.trim();
  if (last) {
    try {
      const obj = JSON.parse(last);
      batch.push(transformRecord(tableName, obj));
    } catch (e) {
      return { imported, failed: true, error: `Invalid NDJSON last line: ${String(e)}` };
    }
  }

  const f = await flush();
  if (!f.ok) return { imported, failed: true, error: f.error };

  return { imported, failed: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, tables } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const workspaceId = Deno.env.get("FABRIC_WORKSPACE_ID");
    const lakehouseId = Deno.env.get("FABRIC_LAKEHOUSE_ID");

    if (!workspaceId || !lakehouseId) {
      throw new Error("Fabric Lakehouse credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Getting Azure token for OneLake...");
    console.log(`Using Service Principal - Client ID: ${Deno.env.get("AZURE_CLIENT_ID")}`);
    console.log(`Using Tenant ID: ${Deno.env.get("AZURE_TENANT_ID")}`);
    const accessToken = await getOneLakeToken();
    console.log("Token obtained successfully");

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
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (action === "sync") {
      const tablesToSync = tables && tables.length > 0 ? tables : ALL_TABLES;
      const results: SyncResult[] = [];

      for (const tableName of tablesToSync) {
        const fabricTableName = getFabricTableName(tableName);

        try {
          console.log(`Syncing table: ${tableName} -> ${fabricTableName}`);

          // Fetch all data from table
          const { data, error } = await supabase.from(tableName).select("*");

          if (error) {
            console.error(`Error fetching ${tableName}:`, error);
            results.push({ table: tableName, fabricTable: fabricTableName, success: false, error: error.message });
            continue;
          }

          if (!data || data.length === 0) {
            console.log(`Table ${tableName} is empty, creating empty files`);
            results.push({ table: tableName, fabricTable: fabricTableName, success: true, rowCount: 0 });
            continue;
          }

          // Upload as CSV (primary - visible in Fabric)
          const rowCount = await uploadAsCSV(accessToken, workspaceId, lakehouseId, fabricTableName, data);

          // Also upload as JSON for programmatic access
          await uploadAsJSON(accessToken, workspaceId, lakehouseId, fabricTableName, data);

          results.push({ table: tableName, fabricTable: fabricTableName, success: true, rowCount });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.error(`Error syncing ${tableName}:`, error);
          results.push({ table: tableName, fabricTable: fabricTableName, success: false, error: errorMessage });
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
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
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
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Import data from Fabric Lakehouse back to Supabase
    if (action === "import") {
      const tablesToImport = tables && tables.length > 0 ? tables : ALL_TABLES;
      const results: SyncResult[] = [];
      const syncBackPath =
        `${lakehouseRootUrl("https://onelake.dfs.fabric.microsoft.com", workspaceId, lakehouseId)}/Files/_sync_back`;

      for (const inputName of tablesToImport) {
        const tableName = inputName.startsWith(TABLE_PREFIX) ? getSupabaseTableName(inputName) : inputName;
        const fabricTableName = getFabricTableName(tableName);

        try {
          console.log(`Importing table: ${fabricTableName} -> ${tableName}`);

          // Try both naming conventions: with prefix and without
          const possibleFiles = [`${syncBackPath}/${fabricTableName}.json`, `${syncBackPath}/${tableName}.json`];

          let usedPath = "";
          let found = false;

          for (const filePath of possibleFiles) {
            const checkResponse = await fetch(`${filePath}?action=getStatus`, {
              method: "HEAD",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "x-ms-version": "2021-06-08",
              },
            });

            if (checkResponse.ok || checkResponse.status === 200) {
              usedPath = filePath;
              found = true;
              break;
            }
          }

          if (!found) {
            console.log(`No import file found for ${tableName}, skipping`);
            results.push({ table: tableName, fabricTable: fabricTableName, success: true, rowCount: 0 });
            continue;
          }

          console.log(`Found import file at: ${usedPath}`);

          // IMPORTANT: Expect NDJSON for large tables (supplier_purchase_enrichment)
          const out = await importNdjsonStreaming(supabase, tableName, usedPath, accessToken);

          results.push({
            table: tableName,
            fabricTable: fabricTableName,
            success: !out.failed,
            rowCount: out.impo
