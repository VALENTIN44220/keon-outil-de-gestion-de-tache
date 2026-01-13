import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface ExcelRow {
  values: (string | number | null)[][];
}

interface BEProject {
  id?: string;
  code_projet: string;
  nom_projet: string;
  description?: string | null;
  adresse_site?: string | null;
  adresse_societe?: string | null;
  pays?: string | null;
  pays_site?: string | null;
  code_divalto?: string | null;
  siret?: string | null;
  date_cloture_bancaire?: string | null;
  date_cloture_juridique?: string | null;
  date_os_etude?: string | null;
  date_os_travaux?: string | null;
  actionnariat?: string | null;
  regime_icpe?: string | null;
  typologie?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

// Column mapping: Excel column index -> DB field name
const COLUMN_MAPPING = {
  0: 'code_projet',
  1: 'nom_projet',
  2: 'description',
  3: 'adresse_site',
  4: 'adresse_societe',
  5: 'pays',
  6: 'pays_site',
  7: 'code_divalto',
  8: 'siret',
  9: 'date_cloture_bancaire',
  10: 'date_cloture_juridique',
  11: 'date_os_etude',
  12: 'date_os_travaux',
  13: 'actionnariat',
  14: 'regime_icpe',
  15: 'typologie',
  16: 'status',
};

async function getAccessToken(): Promise<{ token: string; diagnostics: any }> {
  const tenantId = Deno.env.get("AZURE_TENANT_ID");
  const clientId = Deno.env.get("AZURE_CLIENT_ID");
  const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET");

  const diagnostics: any = {
    tenantId: tenantId ? `${tenantId.substring(0, 8)}...` : 'MISSING',
    clientId: clientId ? `${clientId.substring(0, 8)}...` : 'MISSING',
    clientSecretSet: !!clientSecret,
  };

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(`Missing Azure credentials: ${JSON.stringify(diagnostics)}`);
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  console.log(`Requesting token from: ${tokenUrl}`);

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });

  const responseText = await response.text();
  
  if (!response.ok) {
    console.error(`Token request failed (${response.status}):`, responseText);
    diagnostics.tokenError = responseText;
    throw new Error(`Failed to get access token: ${responseText}`);
  }

  const data: TokenResponse = JSON.parse(responseText);
  diagnostics.tokenObtained = true;
  console.log('Access token obtained successfully');
  
  return { token: data.access_token, diagnostics };
}

async function assertGraphAccess(accessToken: string): Promise<{ method: string; details: any }> {
  // Try multiple endpoints to diagnose Graph access issues
  const endpoints = [
    { name: 'organization', url: 'https://graph.microsoft.com/v1.0/organization?$select=id,displayName' },
    { name: 'sites/root', url: 'https://graph.microsoft.com/v1.0/sites/root?$select=id,webUrl,displayName' },
    { name: 'sites-search', url: 'https://graph.microsoft.com/v1.0/sites?search=*&$top=1' },
  ];

  const results: any[] = [];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint.url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const txt = await res.text();
      let data = null;
      try { data = JSON.parse(txt); } catch { data = txt; }
      
      results.push({
        endpoint: endpoint.name,
        status: res.status,
        ok: res.ok,
        data: res.ok ? data : null,
        error: !res.ok ? data : null,
      });

      if (res.ok) {
        console.log(`Graph access OK via ${endpoint.name}`);
        return { method: endpoint.name, details: data };
      }
    } catch (e) {
      results.push({
        endpoint: endpoint.name,
        status: 0,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  console.error('All Graph endpoints failed:', JSON.stringify(results));
  throw new Error(
    `Microsoft Graph access failed on all endpoints. This may indicate: 1) SharePoint Online is not provisioned in your tenant, 2) Conditional Access policies block app-only access, or 3) A temporary Microsoft service issue. Details: ${JSON.stringify(results)}`
  );
}

async function getSiteId(accessToken: string, siteUrl: string): Promise<string> {
  // Parse site URL to get hostname and a *site root* path.
  // Users often paste URLs that include libraries/folders; Graph needs the site root (e.g. /sites/SiteName).
  const url = new URL(siteUrl);
  const hostname = url.hostname;

  // Remove trailing slashes from pathname
  const rawPath = url.pathname.replace(/\/+$/, '');

  // Keep only the site root segment (supports /sites/<name> and /teams/<name>)
  const match = rawPath.match(/^(\/(sites|teams)\/[^\/]+)(?:\/.*)?$/i);
  const sitePath = match ? match[1] : (rawPath && rawPath !== '/' ? rawPath : '');

  const siteIdentifier = sitePath ? `${hostname}:${encodeURI(sitePath)}:` : hostname;
  console.log(`Looking up SharePoint site: ${siteIdentifier}`);

  const lookupUrl = `https://graph.microsoft.com/v1.0/sites/${siteIdentifier}`;
  const response = await fetch(lookupUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.ok) {
    const site = await response.json();
    console.log(`Site found: ${site.displayName} (ID: ${site.id})`);
    return site.id;
  }

  const errorText = await response.text();
  console.error(`Site lookup failed for ${siteIdentifier}:`, errorText);

  // Fallback: search
  const siteKeyword = (sitePath.split('/').pop() || '').trim();
  if (siteKeyword) {
    const searchUrl = `https://graph.microsoft.com/v1.0/sites?search=${encodeURIComponent(siteKeyword)}`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!searchRes.ok) {
      const searchTxt = await searchRes.text();
      console.error(`Site search failed (keyword=${siteKeyword}):`, searchTxt);
    } else {
      const searchData = await searchRes.json();
      const candidates: any[] = searchData?.value || [];
      console.log(`Site search returned ${candidates.length} candidate(s) for keyword=${siteKeyword}`);

      const normalizedWanted = siteUrl.replace(/\/+$/, '').toLowerCase();
      const best = candidates.find((s) => (s.webUrl || '').replace(/\/+$/, '').toLowerCase() === normalizedWanted)
        || candidates.find((s) => (s.webUrl || '').toLowerCase().startsWith(normalizedWanted));

      if (best?.id) {
        console.log(`Site found via search: ${best.displayName} (ID: ${best.id})`);
        return best.id;
      }
    }
  }

  throw new Error(
    `Failed to get site ID. Check SHAREPOINT_SITE_URL (must point to the site root like https://company.sharepoint.com/sites/SiteName). Original lookup error: ${errorText}`
  );
}

async function getDriveId(accessToken: string, siteId: string): Promise<string> {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drive`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get drive ID: ${error}`);
  }

  const drive = await response.json();
  return drive.id;
}

async function getWorksheetName(
  accessToken: string,
  siteId: string,
  driveId: string,
  filePath: string
): Promise<string> {
  // First, check if file exists and get available worksheets
  const itemPath = filePath.replace(/^\/+/, ''); // Remove leading slashes
  const encodedPath = encodeURIComponent(itemPath);
  
  const worksheetsUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${encodedPath}:/workbook/worksheets`;
  console.log(`Fetching worksheets from: ${worksheetsUrl}`);
  
  const response = await fetch(worksheetsUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Failed to get worksheets: ${error}`);
    
    // Try to check if file exists at all
    const fileCheckUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${encodedPath}`;
    const fileRes = await fetch(fileCheckUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (!fileRes.ok) {
      const fileError = await fileRes.text();
      throw new Error(`File not found at path '${filePath}'. Make sure SHAREPOINT_EXCEL_FILE_PATH is correct (e.g., 'Documents/MyFile.xlsx' without leading slash). Error: ${fileError}`);
    }
    
    throw new Error(`File exists but cannot access workbook. Ensure it's a valid .xlsx file. Error: ${error}`);
  }

  const data = await response.json();
  const worksheets = data.value || [];
  
  if (worksheets.length === 0) {
    throw new Error('No worksheets found in the Excel file');
  }
  
  console.log(`Available worksheets: ${worksheets.map((w: any) => w.name).join(', ')}`);
  
  // Return first worksheet name
  return worksheets[0].name;
}

async function getExcelData(
  accessToken: string,
  siteId: string,
  driveId: string,
  filePath: string
): Promise<ExcelRow> {
  // Get the first worksheet name dynamically
  const worksheetName = await getWorksheetName(accessToken, siteId, driveId, filePath);
  console.log(`Using worksheet: ${worksheetName}`);
  
  const itemPath = filePath.replace(/^\/+/, '');
  const encodedPath = encodeURIComponent(itemPath);
  const encodedWorksheet = encodeURIComponent(worksheetName);
  
  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${encodedPath}:/workbook/worksheets('${encodedWorksheet}')/usedRange`;
  console.log(`Fetching Excel data from: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Excel data: ${error}`);
  }

  return await response.json();
}

async function updateExcelData(
  accessToken: string,
  siteId: string,
  driveId: string,
  filePath: string,
  data: (string | number | null)[][]
): Promise<void> {
  // Get the first worksheet name dynamically
  const worksheetName = await getWorksheetName(accessToken, siteId, driveId, filePath);
  console.log(`Writing to worksheet: ${worksheetName}`);
  
  const itemPath = filePath.replace(/^\/+/, '');
  const encodedPath = encodeURIComponent(itemPath);
  const encodedWorksheet = encodeURIComponent(worksheetName);
  
  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${encodedPath}:/workbook/worksheets('${encodedWorksheet}')/range(address='A1:Q${data.length}')`;
  console.log(`Updating Excel data at: ${url}`);
  
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      values: data,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update Excel data: ${error}`);
  }
}

function excelRowToProject(row: (string | number | null)[]): Partial<BEProject> {
  const project: Partial<BEProject> = {};
  
  Object.entries(COLUMN_MAPPING).forEach(([index, field]) => {
    const value = row[parseInt(index)];
    if (value !== null && value !== undefined && value !== '') {
      (project as any)[field] = String(value);
    }
  });

  return project;
}

function projectToExcelRow(project: BEProject): (string | number | null)[] {
  const row: (string | number | null)[] = [];
  
  Object.entries(COLUMN_MAPPING).forEach(([index, field]) => {
    const value = (project as any)[field];
    row[parseInt(index)] = value ?? null;
  });

  return row;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const siteUrl = Deno.env.get("SHAREPOINT_SITE_URL")!;
    const filePath = Deno.env.get("SHAREPOINT_EXCEL_FILE_PATH")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { action, preview = false } = await req.json();

    // Handle diagnostic action
    if (action === "diagnose") {
      const diagnosticResults: any = {
        step: 'init',
        siteUrlSet: !!siteUrl,
        filePathSet: !!filePath,
        siteUrlValue: siteUrl ? siteUrl.replace(/\/[^\/]+$/, '/...') : 'NOT SET',
      };

      try {
        diagnosticResults.step = 'token';
        const { token, diagnostics } = await getAccessToken();
        diagnosticResults.tokenDiagnostics = diagnostics;

        diagnosticResults.step = 'graphAccess';
        const graphResult = await assertGraphAccess(token);
        diagnosticResults.graphAccessOk = true;
        diagnosticResults.graphAccessMethod = graphResult.method;
        diagnosticResults.graphAccessDetails = graphResult.details;

        diagnosticResults.step = 'siteId';
        const siteId = await getSiteId(token, siteUrl);
        diagnosticResults.siteId = siteId ? `${siteId.substring(0, 20)}...` : null;

        diagnosticResults.step = 'driveId';
        const driveId = await getDriveId(token, siteId);
        diagnosticResults.driveId = driveId ? `${driveId.substring(0, 20)}...` : null;

        diagnosticResults.step = 'complete';
        diagnosticResults.success = true;
      } catch (error: unknown) {
        diagnosticResults.error = error instanceof Error ? error.message : String(error);
        diagnosticResults.failedAtStep = diagnosticResults.step;
      }

      return new Response(
        JSON.stringify({ diagnostics: diagnosticResults }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Microsoft Graph access token
    const { token: accessToken, diagnostics: tokenDiagnostics } = await getAccessToken();
    await assertGraphAccess(accessToken);

    const siteId = await getSiteId(accessToken, siteUrl);
    const driveId = await getDriveId(accessToken, siteId);

    // Get current DB projects for comparison
    const { data: dbProjects } = await supabase
      .from("be_projects")
      .select("*")
      .order("code_projet");

    const dbProjectsMap = new Map(
      (dbProjects || []).map(p => [p.code_projet, p])
    );

    if (action === "import" || action === "sync") {
      // Get Excel data
      const excelData = await getExcelData(accessToken, siteId, driveId, filePath);
      const rows = excelData.values;

      if (rows.length <= 1) {
        return new Response(
          JSON.stringify({ 
            message: "No data to import (only header row found)", 
            imported: 0,
            preview: { toImport: [], toUpdate: [], toExport: [], unchanged: 0 }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Skip header row and parse
      const dataRows = rows.slice(1);
      const toImport: Partial<BEProject>[] = [];
      const toUpdate: { current: BEProject; incoming: Partial<BEProject>; changes: string[] }[] = [];
      let unchanged = 0;

      for (const row of dataRows) {
        const projectData = excelRowToProject(row);
        
        if (!projectData.code_projet || !projectData.nom_projet) {
          continue;
        }

        const existing = dbProjectsMap.get(projectData.code_projet);
        
        if (existing) {
          // Check for changes
          const changes: string[] = [];
          Object.entries(projectData).forEach(([key, value]) => {
            if (key !== 'code_projet' && (existing as any)[key] !== value) {
              changes.push(key);
            }
          });
          
          if (changes.length > 0) {
            toUpdate.push({ current: existing, incoming: projectData, changes });
          } else {
            unchanged++;
          }
        } else {
          toImport.push(projectData);
        }
      }

      // For sync, also prepare export data (projects in DB but not in Excel)
      const excelCodes = new Set(dataRows.map(row => row[0]?.toString()).filter(Boolean));
      const toExport = action === "sync" 
        ? (dbProjects || []).filter(p => !excelCodes.has(p.code_projet))
        : [];

      // If preview mode, return comparison without making changes
      if (preview) {
        return new Response(
          JSON.stringify({
            preview: {
              toImport,
              toUpdate,
              toExport,
              unchanged,
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Execute actual import
      let imported = 0;
      let updated = 0;

      for (const projectData of toImport) {
        await supabase.from("be_projects").insert(projectData);
        imported++;
      }

      for (const item of toUpdate) {
        await supabase
          .from("be_projects")
          .update(item.incoming)
          .eq("id", item.current.id);
        updated++;
      }

      if (action === "sync" && dbProjects && dbProjects.length > 0) {
        // Export all DB projects to Excel
        const header = Object.values(COLUMN_MAPPING);
        const excelRows = [header, ...dbProjects.map(projectToExcelRow)];
        await updateExcelData(accessToken, siteId, driveId, filePath, excelRows);
      }

      return new Response(
        JSON.stringify({ 
          message: "Import completed", 
          imported, 
          updated,
          action 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "export") {
      const projects = dbProjects || [];

      // If preview mode, return what will be exported
      if (preview) {
        return new Response(
          JSON.stringify({
            preview: {
              toImport: [],
              toUpdate: [],
              toExport: projects,
              unchanged: 0,
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (projects.length === 0) {
        return new Response(
          JSON.stringify({ message: "No projects to export", exported: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const header = Object.values(COLUMN_MAPPING);
      const excelRows = [header, ...projects.map(projectToExcelRow)];
      
      await updateExcelData(accessToken, siteId, driveId, filePath, excelRows);

      return new Response(
        JSON.stringify({ message: "Export completed", exported: projects.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'import', 'export', or 'sync'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("SharePoint Excel sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
