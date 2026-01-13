import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// Table configurations for governance sync
interface TableConfig {
  name: string;
  fileName: string;
  label: string;
  columns: string[];
}

const GOVERNANCE_TABLES: TableConfig[] = [
  {
    name: 'companies',
    fileName: 'APP_GESTION_COMPANIES.xlsx',
    label: 'Sociétés',
    columns: ['id', 'name', 'description', 'created_at', 'updated_at'],
  },
  {
    name: 'departments',
    fileName: 'APP_GESTION_DEPARTMENTS.xlsx',
    label: 'Services',
    columns: ['id', 'name', 'description', 'company_id', 'created_at', 'updated_at'],
  },
  {
    name: 'job_titles',
    fileName: 'APP_GESTION_JOB_TITLES.xlsx',
    label: 'Postes',
    columns: ['id', 'name', 'description', 'department_id', 'created_at', 'updated_at'],
  },
  {
    name: 'hierarchy_levels',
    fileName: 'APP_GESTION_HIERARCHY_LEVELS.xlsx',
    label: 'Hiérarchie',
    columns: ['id', 'name', 'description', 'level', 'created_at', 'updated_at'],
  },
  {
    name: 'permission_profiles',
    fileName: 'APP_GESTION_PERMISSION_PROFILES.xlsx',
    label: 'Droits',
    columns: [
      'id', 'name', 'description',
      'can_view_own_tasks', 'can_view_subordinates_tasks', 'can_view_all_tasks',
      'can_manage_own_tasks', 'can_manage_subordinates_tasks', 'can_manage_all_tasks',
      'can_assign_to_subordinates', 'can_assign_to_all',
      'can_manage_templates', 'can_manage_users',
      'can_view_be_projects', 'can_create_be_projects', 'can_edit_be_projects', 'can_delete_be_projects',
      'created_at', 'updated_at'
    ],
  },
  {
    name: 'profiles',
    fileName: 'APP_GESTION_PROFILES.xlsx',
    label: 'Utilisateurs',
    columns: [
      'id', 'user_id', 'display_name', 'job_title', 'department', 'company',
      'company_id', 'department_id', 'job_title_id', 'hierarchy_level_id',
      'permission_profile_id', 'manager_id', 'avatar_url',
      'is_private', 'must_change_password', 'created_at', 'updated_at'
    ],
  },
  {
    name: 'assignment_rules',
    fileName: 'APP_GESTION_ASSIGNMENT_RULES.xlsx',
    label: 'Affectation',
    columns: [
      'id', 'name', 'description', 'is_active', 'priority',
      'category_id', 'subcategory_id', 'target_department_id', 'target_assignee_id',
      'auto_assign', 'requires_validation', 'created_at', 'updated_at'
    ],
  },
  {
    name: 'categories',
    fileName: 'APP_GESTION_CATEGORIES.xlsx',
    label: 'Catégories',
    columns: ['id', 'name', 'description', 'created_at', 'updated_at'],
  },
];

async function getAccessToken(): Promise<string> {
  const tenantId = Deno.env.get("AZURE_TENANT_ID");
  const clientId = Deno.env.get("AZURE_CLIENT_ID");
  const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET");

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Missing Azure credentials");
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data: TokenResponse = await response.json();
  return data.access_token;
}

async function getSiteId(accessToken: string, siteUrl: string): Promise<string> {
  const url = new URL(siteUrl);
  const hostname = url.hostname;
  const rawPath = url.pathname.replace(/\/+$/, '');
  const match = rawPath.match(/^(\/(sites|teams)\/[^\/]+)(?:\/.*)?$/i);
  const sitePath = match ? match[1] : (rawPath && rawPath !== '/' ? rawPath : '');

  const siteIdentifier = sitePath ? `${hostname}:${encodeURI(sitePath)}:` : hostname;
  const lookupUrl = `https://graph.microsoft.com/v1.0/sites/${siteIdentifier}`;
  
  const response = await fetch(lookupUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get site ID: ${error}`);
  }

  const site = await response.json();
  return site.id;
}

async function getDriveId(accessToken: string, siteId: string): Promise<string> {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drive`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get drive ID: ${error}`);
  }

  const drive = await response.json();
  return drive.id;
}

async function ensureFolderExists(
  accessToken: string,
  siteId: string,
  driveId: string,
  folderPath: string
): Promise<void> {
  const parts = folderPath.split('/').filter(Boolean);
  let currentPath = '';

  for (const part of parts) {
    const parentPath = currentPath ? `/root:/${encodeURIComponent(currentPath)}:/children` : '/root/children';
    const checkUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}${parentPath}`;

    const listRes = await fetch(checkUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let folderExists = false;
    if (listRes.ok) {
      const listData = await listRes.json();
      folderExists = (listData.value || []).some(
        (item: any) => item.folder && item.name.toLowerCase() === part.toLowerCase()
      );
    }

    if (!folderExists) {
      const createUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}${parentPath}`;
      const createRes = await fetch(createUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: part,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'fail',
        }),
      });

      if (!createRes.ok && createRes.status !== 409) {
        const error = await createRes.text();
        console.log(`Could not create folder ${part}: ${error}`);
      }
    }

    currentPath = currentPath ? `${currentPath}/${part}` : part;
  }
}

async function downloadExcel(
  accessToken: string,
  siteId: string,
  driveId: string,
  filePath: string
): Promise<any[][] | null> {
  const cleanPath = filePath.replace(/^\/+/, '');
  const encodedPath = encodeURIComponent(cleanPath);
  
  const contentUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${encodedPath}:/content`;
  
  const response = await fetch(contentUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null; // File doesn't exist
    }
    const error = await response.text();
    throw new Error(`Failed to download Excel file: ${error}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  return XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][];
}

async function uploadExcel(
  accessToken: string,
  siteId: string,
  driveId: string,
  filePath: string,
  data: any[][],
  sheetName: string = 'Data'
): Promise<void> {
  const cleanPath = filePath.replace(/^\/+/, '');
  const encodedPath = encodeURIComponent(cleanPath);
  
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  
  const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${encodedPath}:/content`;
  
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    body: excelBuffer,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload Excel file: ${error}`);
  }
}

function rowToObject(row: any[], columns: string[]): Record<string, any> {
  const obj: Record<string, any> = {};
  columns.forEach((col, idx) => {
    const value = row[idx];
    if (value !== null && value !== undefined && value !== '') {
      // Handle booleans
      if (value === 'true' || value === true) {
        obj[col] = true;
      } else if (value === 'false' || value === false) {
        obj[col] = false;
      } else {
        obj[col] = value;
      }
    }
  });
  return obj;
}

function objectToRow(obj: Record<string, any>, columns: string[]): any[] {
  return columns.map(col => {
    const value = obj[col];
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value;
    return value;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const siteUrl = Deno.env.get("SHAREPOINT_GOVERNANCE_SITE_URL")!;
    
    if (!siteUrl) {
      throw new Error("SHAREPOINT_GOVERNANCE_SITE_URL not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { action, tables, preview = false } = await req.json();

    const accessToken = await getAccessToken();
    const siteId = await getSiteId(accessToken, siteUrl);
    const driveId = await getDriveId(accessToken, siteId);
    
    const basePath = 'BDD/SOURCES/APP_GESTION_TASK';
    
    // Ensure folder structure exists
    await ensureFolderExists(accessToken, siteId, driveId, basePath);

    // Determine which tables to process
    const tablesToProcess = tables 
      ? GOVERNANCE_TABLES.filter(t => tables.includes(t.name))
      : GOVERNANCE_TABLES;

    if (action === 'diagnose') {
      const results: any = {
        siteUrl,
        siteId: siteId ? `${siteId.substring(0, 20)}...` : null,
        driveId: driveId ? `${driveId.substring(0, 20)}...` : null,
        basePath,
        files: [],
      };

      for (const table of tablesToProcess) {
        const filePath = `${basePath}/${table.fileName}`;
        try {
          const fileUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${encodeURIComponent(filePath)}`;
          const fileRes = await fetch(fileUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          results.files.push({
            table: table.name,
            fileName: table.fileName,
            exists: fileRes.ok,
          });
        } catch (e) {
          results.files.push({
            table: table.name,
            fileName: table.fileName,
            exists: false,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      return new Response(
        JSON.stringify({ diagnostics: results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'export') {
      const results: any = {
        exported: [],
        errors: [],
      };

      for (const table of tablesToProcess) {
        try {
          const { data, error } = await supabase
            .from(table.name)
            .select('*');

          if (error) {
            results.errors.push({ table: table.name, error: error.message });
            continue;
          }

          if (!data || data.length === 0) {
            results.exported.push({ table: table.name, count: 0 });
            continue;
          }

          // Build Excel data with headers
          const excelData: any[][] = [table.columns];
          for (const row of data) {
            excelData.push(objectToRow(row, table.columns));
          }

          const filePath = `${basePath}/${table.fileName}`;
          await uploadExcel(accessToken, siteId, driveId, filePath, excelData, table.label);

          results.exported.push({
            table: table.name,
            fileName: table.fileName,
            count: data.length,
          });
        } catch (e) {
          results.errors.push({
            table: table.name,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      return new Response(
        JSON.stringify(results),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'import') {
      const results: any = {
        imported: [],
        updated: [],
        idsGenerated: [],
        errors: [],
      };

      for (const table of tablesToProcess) {
        try {
          const filePath = `${basePath}/${table.fileName}`;
          const excelData = await downloadExcel(accessToken, siteId, driveId, filePath);

          if (!excelData) {
            results.errors.push({ table: table.name, error: 'File not found' });
            continue;
          }

          const headers = excelData[0] as string[];
          const dataRows = excelData.slice(1).filter(row => row && row.length > 0 && (row[0] || row[1])); // Allow rows without ID if they have other data
          
          // Find the ID column index
          const idColumnIndex = headers.findIndex(h => h === 'id');
          if (idColumnIndex === -1) {
            results.errors.push({ table: table.name, error: 'No ID column found in headers' });
            continue;
          }

          // Get existing data
          const { data: existingData, error: fetchError } = await supabase
            .from(table.name)
            .select('id');

          if (fetchError) {
            results.errors.push({ table: table.name, error: fetchError.message });
            continue;
          }

          const existingIds = new Set((existingData || []).map(r => r.id));
          let importedCount = 0;
          let updatedCount = 0;
          let idsGeneratedCount = 0;
          let excelNeedsUpdate = false;

          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const obj = rowToObject(row, table.columns);
            
            // Generate UUID if ID is missing or empty
            if (!obj.id || obj.id === '' || obj.id === null) {
              // Generate a new UUID
              obj.id = crypto.randomUUID();
              // Update the row in excelData for later upload
              if (row.length <= idColumnIndex) {
                // Extend row if needed
                while (row.length <= idColumnIndex) {
                  row.push(null);
                }
              }
              row[idColumnIndex] = obj.id;
              excelData[i + 1][idColumnIndex] = obj.id; // +1 because first row is header
              idsGeneratedCount++;
              excelNeedsUpdate = true;
            }

            // Skip rows that still don't have a valid ID (shouldn't happen now)
            if (!obj.id) continue;

            // Check if row has meaningful data (at least one non-id field)
            const hasData = Object.keys(obj).some(key => key !== 'id' && key !== 'created_at' && key !== 'updated_at' && obj[key] !== null && obj[key] !== undefined);
            if (!hasData) continue;

            if (existingIds.has(obj.id)) {
              const { error: updateError } = await supabase
                .from(table.name)
                .update(obj)
                .eq('id', obj.id);

              if (!updateError) updatedCount++;
            } else {
              // Set created_at if not present
              if (!obj.created_at) {
                obj.created_at = new Date().toISOString();
              }
              
              const { error: insertError } = await supabase
                .from(table.name)
                .insert(obj);

              if (!insertError) {
                importedCount++;
                existingIds.add(obj.id); // Add to set to prevent duplicate inserts
              } else {
                console.log(`Insert error for ${table.name}:`, insertError.message);
              }
            }
          }

          // If we generated IDs, update the Excel file on SharePoint
          if (excelNeedsUpdate) {
            await uploadExcel(accessToken, siteId, driveId, filePath, excelData, table.label);
          }

          results.imported.push({ table: table.name, count: importedCount });
          results.updated.push({ table: table.name, count: updatedCount });
          if (idsGeneratedCount > 0) {
            results.idsGenerated.push({ table: table.name, count: idsGeneratedCount });
          }
        } catch (e) {
          results.errors.push({
            table: table.name,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      return new Response(
        JSON.stringify(results),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'preview') {
      const results: any = {
        tables: [],
      };

      for (const table of tablesToProcess) {
        try {
          const filePath = `${basePath}/${table.fileName}`;
          const excelData = await downloadExcel(accessToken, siteId, driveId, filePath);

          const { data: dbData, error } = await supabase
            .from(table.name)
            .select('id');

          const dbCount = dbData?.length || 0;
          const excelCount = excelData ? Math.max(0, excelData.length - 1) : 0;

          results.tables.push({
            name: table.name,
            label: table.label,
            fileName: table.fileName,
            fileExists: !!excelData,
            dbCount,
            excelCount,
          });
        } catch (e) {
          results.tables.push({
            name: table.name,
            label: table.label,
            fileName: table.fileName,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      return new Response(
        JSON.stringify(results),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
