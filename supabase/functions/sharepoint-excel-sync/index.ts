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
const COLUMN_MAPPING: Record<number, keyof BEProject> = {
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
    `Microsoft Graph access failed on all endpoints. Details: ${JSON.stringify(results)}`
  );
}

async function getSiteId(accessToken: string, siteUrl: string): Promise<string> {
  const url = new URL(siteUrl);
  const hostname = url.hostname;
  const rawPath = url.pathname.replace(/\/+$/, '');
  const match = rawPath.match(/^(\/(sites|teams)\/[^\/]+)(?:\/.*)?$/i);
  const sitePath = match ? match[1] : (rawPath && rawPath !== '/' ? rawPath : '');

  const siteIdentifier = sitePath ? `${hostname}:${encodeURI(sitePath)}:` : hostname;
  console.log(`Looking up SharePoint site: ${siteIdentifier}`);

  const lookupUrl = `https://graph.microsoft.com/v1.0/sites/${siteIdentifier}`;
  const response = await fetch(lookupUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.ok) {
    const site = await response.json();
    console.log(`Site found: ${site.displayName} (ID: ${site.id})`);
    return site.id;
  }

  const errorText = await response.text();
  console.error(`Site lookup failed for ${siteIdentifier}:`, errorText);

  const siteKeyword = (sitePath.split('/').pop() || '').trim();
  if (siteKeyword) {
    const searchUrl = `https://graph.microsoft.com/v1.0/sites?search=${encodeURIComponent(siteKeyword)}`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const candidates: any[] = searchData?.value || [];
      console.log(`Site search returned ${candidates.length} candidate(s)`);

      const normalizedWanted = siteUrl.replace(/\/+$/, '').toLowerCase();
      const best = candidates.find((s) => (s.webUrl || '').replace(/\/+$/, '').toLowerCase() === normalizedWanted)
        || candidates.find((s) => (s.webUrl || '').toLowerCase().startsWith(normalizedWanted));

      if (best?.id) {
        console.log(`Site found via search: ${best.displayName} (ID: ${best.id})`);
        return best.id;
      }
    }
  }

  throw new Error(`Failed to get site ID. Check SHAREPOINT_SITE_URL. Error: ${errorText}`);
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

// Download Excel file as binary and parse with SheetJS
async function downloadAndParseExcel(
  accessToken: string,
  siteId: string,
  driveId: string,
  filePath: string
): Promise<(string | number | null)[][]> {
  const cleanPath = filePath.replace(/^\/+/, '');
  const encodedPath = encodeURIComponent(cleanPath);
  
  // Get file content directly (not workbook API)
  const contentUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${encodedPath}:/content`;
  console.log(`Downloading Excel file from: ${contentUrl}`);
  
  const response = await fetch(contentUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to download Excel file: ${error}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  
  console.log(`Downloaded ${data.length} bytes, parsing with SheetJS...`);
  
  // Parse with SheetJS
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  console.log(`Using worksheet: ${firstSheetName}`);
  
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
  
  console.log(`Parsed ${jsonData.length} rows from Excel`);
  
  return jsonData as (string | number | null)[][];
}

// Upload Excel file by creating new content
async function uploadExcel(
  accessToken: string,
  siteId: string,
  driveId: string,
  filePath: string,
  data: (string | number | null)[][]
): Promise<void> {
  const cleanPath = filePath.replace(/^\/+/, '');
  const encodedPath = encodeURIComponent(cleanPath);
  
  console.log(`Creating Excel file with ${data.length} rows...`);
  
  // Create workbook with SheetJS
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Projets');
  
  // Write to binary
  const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  
  // Upload to SharePoint
  const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${encodedPath}:/content`;
  console.log(`Uploading Excel file to: ${uploadUrl}`);
  
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
  
  console.log('Excel file uploaded successfully');
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
        filePathValue: filePath || 'NOT SET',
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

        diagnosticResults.step = 'siteId';
        const siteId = await getSiteId(token, siteUrl);
        diagnosticResults.siteId = siteId ? `${siteId.substring(0, 20)}...` : null;

        diagnosticResults.step = 'driveId';
        const driveId = await getDriveId(token, siteId);
        diagnosticResults.driveId = driveId ? `${driveId.substring(0, 20)}...` : null;

        // List root folder contents
        diagnosticResults.step = 'listFiles';
        try {
          const listUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root/children?$select=name,folder,file&$top=20`;
          const listRes = await fetch(listUrl, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (listRes.ok) {
            const listData = await listRes.json();
            diagnosticResults.rootItems = (listData.value || []).map((item: any) => ({
              name: item.name,
              type: item.folder ? 'folder' : 'file',
            }));
          }
        } catch (e) {
          console.log('Could not list root items:', e);
        }

        // Try to find the Excel file
        diagnosticResults.step = 'findFile';
        const cleanPath = filePath.replace(/^\/+/, '');
        const encodedPath = encodeURIComponent(cleanPath);
        const fileUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${encodedPath}`;
        const fileRes = await fetch(fileUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (fileRes.ok) {
          const fileData = await fileRes.json();
          diagnosticResults.fileFound = true;
          diagnosticResults.fileName = fileData.name;
        } else {
          diagnosticResults.fileFound = false;
          diagnosticResults.fileError = await fileRes.text();
          
          // Try alternative paths
          const alternatives = [
            cleanPath.replace(/^Shared Documents\//, ''),
            cleanPath.replace(/^Documents\//, ''),
            `General/${cleanPath.split('/').pop()}`,
            cleanPath.split('/').pop(),
          ];
          
          for (const altPath of alternatives) {
            if (!altPath || altPath === cleanPath) continue;
            const altUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${encodeURIComponent(altPath)}`;
            const altRes = await fetch(altUrl, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (altRes.ok) {
              diagnosticResults.suggestedPath = altPath;
              break;
            }
          }
        }

        diagnosticResults.step = 'complete';
        diagnosticResults.success = diagnosticResults.fileFound === true;
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
    const { token: accessToken } = await getAccessToken();
    await assertGraphAccess(accessToken);

    const siteId = await getSiteId(accessToken, siteUrl);
    const driveId = await getDriveId(accessToken, siteId);

    if (action === "import" || action === "sync") {
      // Download and parse Excel file using direct download + SheetJS
      const excelData = await downloadAndParseExcel(accessToken, siteId, driveId, filePath);

      // Skip header row
      const dataRows = excelData.slice(1).filter(row => 
        row && row.length > 0 && row[0] !== null && row[0] !== ''
      );

      // Get existing projects
      const { data: existingProjects, error: fetchError } = await supabase
        .from("be_projects")
        .select("*");

      if (fetchError) throw fetchError;

      const existingByCode = new Map(
        (existingProjects || []).map((p) => [p.code_projet, p])
      );

      const toImport: any[] = [];
      const toUpdate: any[] = [];
      let unchanged = 0;

      for (const row of dataRows) {
        const excelProject = excelRowToProject(row);
        if (!excelProject.code_projet) continue;

        const existing = existingByCode.get(excelProject.code_projet);

        if (!existing) {
          toImport.push(excelProject);
        } else {
          const changes: string[] = [];
          Object.entries(excelProject).forEach(([key, value]) => {
            if (key !== 'code_projet' && existing[key] !== value) {
              changes.push(key);
            }
          });

          if (changes.length > 0) {
            toUpdate.push({
              current: existing,
              incoming: excelProject,
              changes,
            });
          } else {
            unchanged++;
          }
        }
      }

      // For sync, also prepare export data
      const toExport: any[] = [];
      if (action === "sync") {
        const excelCodes = new Set(dataRows.map((r) => r[0]).filter(Boolean));
        (existingProjects || []).forEach((p) => {
          if (!excelCodes.has(p.code_projet)) {
            toExport.push(p);
          }
        });
      }

      if (preview) {
        return new Response(
          JSON.stringify({
            preview: { toImport, toUpdate, toExport, unchanged },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Execute import
      let imported = 0;
      let updated = 0;

      for (const project of toImport) {
        const { error } = await supabase.from("be_projects").insert({
          ...project,
          status: project.status || "actif",
        });
        if (!error) imported++;
      }

      for (const { current, incoming } of toUpdate) {
        const { error } = await supabase
          .from("be_projects")
          .update(incoming)
          .eq("id", current.id);
        if (!error) updated++;
      }

      // For sync, also export to Excel
      if (action === "sync" && toExport.length > 0) {
        const { data: allProjects } = await supabase
          .from("be_projects")
          .select("*")
          .order("code_projet");

        if (allProjects && allProjects.length > 0) {
          const headerRow = Object.values(COLUMN_MAPPING);
          const exportData = [headerRow, ...allProjects.map(projectToExcelRow)];
          await uploadExcel(accessToken, siteId, driveId, filePath, exportData);
        }
      }

      return new Response(
        JSON.stringify({ imported, updated, exported: toExport.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "export") {
      const { data: projects, error } = await supabase
        .from("be_projects")
        .select("*")
        .order("code_projet");

      if (error) throw error;

      if (preview) {
        return new Response(
          JSON.stringify({
            preview: {
              toImport: [],
              toUpdate: [],
              toExport: projects || [],
              unchanged: 0,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const headerRow = Object.values(COLUMN_MAPPING);
      const exportData = [headerRow, ...(projects || []).map(projectToExcelRow)];
      
      await uploadExcel(accessToken, siteId, driveId, filePath, exportData);

      return new Response(
        JSON.stringify({ exported: projects?.length || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: unknown) {
    console.error("SharePoint Excel sync error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
