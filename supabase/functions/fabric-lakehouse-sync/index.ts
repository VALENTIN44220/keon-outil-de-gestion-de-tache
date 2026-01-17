import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// All tables to sync
const ALL_TABLES = [
  'assignment_rules',
  'be_projects',
  'be_request_details',
  'be_request_sub_processes',
  'be_task_labels',
  'categories',
  'collaborator_group_members',
  'collaborator_groups',
  'companies',
  'departments',
  'hierarchy_levels',
  'holidays',
  'job_titles',
  'pending_task_assignments',
  'permission_profiles',
  'process_template_visible_companies',
  'process_template_visible_departments',
  'process_templates',
  'profiles',
  'request_field_values',
  'sub_process_template_visible_companies',
  'sub_process_template_visible_departments',
  'sub_process_templates',
  'subcategories',
  'task_attachments',
  'task_checklists',
  'task_template_checklists',
  'task_template_visible_companies',
  'task_template_visible_departments',
  'task_templates',
  'task_validation_levels',
  'tasks',
  'template_custom_fields',
  'template_validation_levels',
  'user_leaves',
  'user_roles',
  'workload_slots',
];

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface SyncResult {
  table: string;
  success: boolean;
  rowCount?: number;
  error?: string;
}

// Get Azure AD token for OneLake (Storage scope)
async function getOneLakeToken(): Promise<string> {
  const tenantId = Deno.env.get('AZURE_TENANT_ID');
  const clientId = Deno.env.get('AZURE_CLIENT_ID');
  const clientSecret = Deno.env.get('AZURE_CLIENT_SECRET');

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Azure credentials not configured');
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://storage.azure.com/.default',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Token error:', errorText);
    throw new Error(`Failed to get Azure token: ${response.status}`);
  }

  const data: TokenResponse = await response.json();
  return data.access_token;
}

// Convert data to NDJSON format (suitable for Delta/Parquet ingestion)
function toNDJSON(data: Record<string, unknown>[]): string {
  return data.map((row) => JSON.stringify(row)).join('\n');
}

function isGuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}

function lakehouseRootUrl(baseUrl: string, workspaceId: string, lakehouseIdOrName: string): string {
  // OneLake rule: if you reference by GUIDs, you must NOT include the item type extension (e.g. .Lakehouse)
  if (isGuid(workspaceId) && isGuid(lakehouseIdOrName)) {
    return `${baseUrl}/${workspaceId}/${lakehouseIdOrName}`;
  }
  return `${baseUrl}/${workspaceId}/${lakehouseIdOrName}.Lakehouse`;
}

// Create or replace file in OneLake
async function uploadToOneLake(
  accessToken: string,
  workspaceId: string,
  lakehouseId: string,
  tableName: string,
  content: string
): Promise<void> {
  const baseUrl = 'https://onelake.dfs.fabric.microsoft.com';
  const filePath = `Tables/_staging/${tableName}/${tableName}_${new Date().toISOString().split('T')[0]}.json`;
  const root = lakehouseRootUrl(baseUrl, workspaceId, lakehouseId);
  const fullPath = `${root}/Files/${filePath}`;

  console.log(`Uploading to: ${fullPath}`);

  // Create file using PUT
  const createResponse = await fetch(`${fullPath}?resource=file`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Length': '0',
    },
  });

  if (!createResponse.ok && createResponse.status !== 201) {
    // If file exists, that's OK - we'll overwrite it
    if (createResponse.status !== 409) {
      const errorText = await createResponse.text();
      console.error(`Create file error: ${createResponse.status}`, errorText);
      throw new Error(`Failed to create file: ${createResponse.status}`);
    }
  }

  // Upload content using PATCH
  const contentBytes = new TextEncoder().encode(content);
  const uploadResponse = await fetch(`${fullPath}?action=append&position=0`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
      'Content-Length': contentBytes.length.toString(),
    },
    body: contentBytes,
  });

  if (!uploadResponse.ok && uploadResponse.status !== 202) {
    const errorText = await uploadResponse.text();
    console.error(`Append error: ${uploadResponse.status}`, errorText);
    throw new Error(`Failed to append data: ${uploadResponse.status}`);
  }

  // Flush the file
  const flushResponse = await fetch(`${fullPath}?action=flush&position=${contentBytes.length}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!flushResponse.ok && flushResponse.status !== 200) {
    const errorText = await flushResponse.text();
    console.error(`Flush error: ${flushResponse.status}`, errorText);
    throw new Error(`Failed to flush file: ${flushResponse.status}`);
  }

  console.log(`Successfully uploaded ${tableName}`);
}

// Upload Delta-formatted data (metadata + NDJSON)
async function uploadDeltaTable(
  accessToken: string,
  workspaceId: string,
  lakehouseId: string,
  tableName: string,
  data: Record<string, unknown>[],
  schema: { name: string; type: string }[]
): Promise<number> {
  const baseUrl = 'https://onelake.dfs.fabric.microsoft.com';
  const root = lakehouseRootUrl(baseUrl, workspaceId, lakehouseId);
  const tableBasePath = `${root}/Tables/${tableName}`;

  // Create directory structure
  const timestamp = Date.now();
  const dataFileName = `part-00000-${timestamp}.json`;
  
  // First, ensure the table directory exists
  try {
    await fetch(`${tableBasePath}?resource=directory`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
  } catch {
    // Directory may already exist
  }

  // Create _delta_log directory
  const deltaLogPath = `${tableBasePath}/_delta_log`;
  try {
    await fetch(`${deltaLogPath}?resource=directory`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
  } catch {
    // Directory may already exist
  }

  // Upload data file
  const ndjsonContent = toNDJSON(data);
  const dataPath = `${tableBasePath}/${dataFileName}`;
  
  // Create file
  await fetch(`${dataPath}?resource=file`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Length': '0',
    },
  });

  // Append content
  const contentBytes = new TextEncoder().encode(ndjsonContent);
  await fetch(`${dataPath}?action=append&position=0`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
      'Content-Length': contentBytes.length.toString(),
    },
    body: contentBytes,
  });

  // Flush
  await fetch(`${dataPath}?action=flush&position=${contentBytes.length}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  // Create Delta log entry
  const deltaLog = {
    commitInfo: {
      timestamp,
      operation: 'WRITE',
      operationParameters: { mode: 'Overwrite' },
    },
    protocol: {
      minReaderVersion: 1,
      minWriterVersion: 2,
    },
    metaData: {
      id: crypto.randomUUID(),
      format: { provider: 'json', options: {} },
      schemaString: JSON.stringify({
        type: 'struct',
        fields: schema.map(col => ({
          name: col.name,
          type: col.type,
          nullable: true,
          metadata: {},
        })),
      }),
      partitionColumns: [],
      configuration: {},
      createdTime: timestamp,
    },
    add: {
      path: dataFileName,
      size: contentBytes.length,
      modificationTime: timestamp,
      dataChange: true,
    },
  };

  // Find next log version
  const logFileName = '00000000000000000000.json';
  const logPath = `${deltaLogPath}/${logFileName}`;
  const logContent = JSON.stringify(deltaLog);
  const logBytes = new TextEncoder().encode(logContent);

  await fetch(`${logPath}?resource=file`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Length': '0',
    },
  });

  await fetch(`${logPath}?action=append&position=0`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
      'Content-Length': logBytes.length.toString(),
    },
    body: logBytes,
  });

  await fetch(`${logPath}?action=flush&position=${logBytes.length}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  return data.length;
}

// Infer schema from data
function inferSchema(data: Record<string, unknown>[]): { name: string; type: string }[] {
  if (data.length === 0) return [];
  
  const sample = data[0];
  return Object.entries(sample).map(([key, value]) => {
    let type = 'string';
    if (typeof value === 'number') {
      type = Number.isInteger(value) ? 'long' : 'double';
    } else if (typeof value === 'boolean') {
      type = 'boolean';
    } else if (value instanceof Date) {
      type = 'timestamp';
    } else if (Array.isArray(value)) {
      type = 'array';
    } else if (typeof value === 'object' && value !== null) {
      type = 'struct';
    }
    return { name: key, type };
  });
}

// Check OneLake connectivity
async function checkOneLakeAccess(
  accessToken: string,
  workspaceId: string,
  lakehouseId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const baseUrl = 'https://onelake.dfs.fabric.microsoft.com';
    const root = lakehouseRootUrl(baseUrl, workspaceId, lakehouseId);

    // ADLS Gen2 List Paths (OneLake): list the Files directory in the lakehouse
    // Endpoint form: GET {root}/Files?resource=filesystem&recursive=false
    const listPath = `${root}/Files?resource=filesystem&recursive=false`;
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'x-ms-version': '2021-06-08',
      'x-ms-date': new Date().toUTCString(),
    };

    console.log(`Checking OneLake access at: ${listPath}`);

    const resp = await fetch(listPath, {
      method: 'GET',
      headers,
    });

    console.log(`OneLake response status: ${resp.status}`);

    if (resp.ok || resp.status === 200) {
      return { success: true, message: 'OneLake access verified' };
    } else {
      const errorText = await resp.text();
      console.error(`OneLake access error: ${errorText}`);
      return { success: false, message: `Access denied: ${resp.status} - ${errorText}` };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message: `Connection error: ${errorMessage}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, tables } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const workspaceId = Deno.env.get('FABRIC_WORKSPACE_ID');
    const lakehouseId = Deno.env.get('FABRIC_LAKEHOUSE_ID');

    if (!workspaceId || !lakehouseId) {
      throw new Error('Fabric Lakehouse credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Azure token
  const clientId = Deno.env.get('AZURE_CLIENT_ID');
  const tenantId = Deno.env.get('AZURE_TENANT_ID');
  console.log('Getting Azure token for OneLake...');
  console.log(`Using Service Principal - Client ID: ${clientId}`);
  console.log(`Using Tenant ID: ${tenantId}`);
  const accessToken = await getOneLakeToken();
  console.log('Token obtained successfully');

    if (action === 'diagnose') {
      // Check connectivity
      const accessCheck = await checkOneLakeAccess(accessToken, workspaceId, lakehouseId);
      
      return new Response(JSON.stringify({
        success: accessCheck.success,
        workspaceId,
        lakehouseId,
        message: accessCheck.message,
        tablesCount: ALL_TABLES.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'sync') {
      const tablesToSync = tables && tables.length > 0 ? tables : ALL_TABLES;
      const results: SyncResult[] = [];

      for (const tableName of tablesToSync) {
        try {
          console.log(`Syncing table: ${tableName}`);
          
          // Fetch all data from table
          const { data, error } = await supabase
            .from(tableName)
            .select('*');

          if (error) {
            console.error(`Error fetching ${tableName}:`, error);
            results.push({ table: tableName, success: false, error: error.message });
            continue;
          }

          if (!data || data.length === 0) {
            console.log(`Table ${tableName} is empty, skipping`);
            results.push({ table: tableName, success: true, rowCount: 0 });
            continue;
          }

          // Infer schema and upload as Delta
          const schema = inferSchema(data);
          const rowCount = await uploadDeltaTable(
            accessToken,
            workspaceId,
            lakehouseId,
            tableName,
            data,
            schema
          );

          results.push({ table: tableName, success: true, rowCount });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Error syncing ${tableName}:`, error);
          results.push({ table: tableName, success: false, error: errorMessage });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const totalRows = results.reduce((sum, r) => sum + (r.rowCount || 0), 0);

      return new Response(JSON.stringify({
        success: successCount === results.length,
        syncedTables: successCount,
        totalTables: results.length,
        totalRows,
        results,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'preview') {
      const tablesToSync = tables && tables.length > 0 ? tables : ALL_TABLES;
      const preview = [];

      for (const tableName of tablesToSync) {
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        preview.push({
          table: tableName,
          rowCount: error ? 0 : (count || 0),
          error: error?.message,
        });
      }

      return new Response(JSON.stringify({
        success: true,
        tables: preview,
        totalRows: preview.reduce((sum, t) => sum + t.rowCount, 0),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Fabric Lakehouse sync error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
