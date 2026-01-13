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

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data: TokenResponse = await response.json();
  return data.access_token;
}

async function getSiteId(accessToken: string, siteUrl: string): Promise<string> {
  // Parse site URL to get hostname and site path
  const url = new URL(siteUrl);
  const hostname = url.hostname;
  // Remove trailing slashes from pathname
  const sitePath = url.pathname.replace(/\/+$/, '');

  // Microsoft Graph API format for site lookup:
  // For root site: hostname
  // For subsite: hostname:/sites/SiteName: (note the trailing colon)
  let siteIdentifier: string;
  if (!sitePath || sitePath === '/') {
    // Root site
    siteIdentifier = hostname;
  } else {
    // Subsite - must have colon after hostname and after path
    siteIdentifier = `${hostname}:${sitePath}:`;
  }

  console.log(`Looking up SharePoint site: ${siteIdentifier}`);

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteIdentifier}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error(`Site lookup failed for ${siteIdentifier}:`, error);
    throw new Error(`Failed to get site ID. Check that SHAREPOINT_SITE_URL is correct (e.g., https://company.sharepoint.com/sites/SiteName) and the Azure app has Sites.Read.All permission. Error: ${error}`);
  }

  const site = await response.json();
  console.log(`Site found: ${site.displayName} (ID: ${site.id})`);
  return site.id;
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

async function getExcelData(
  accessToken: string,
  siteId: string,
  driveId: string,
  filePath: string
): Promise<ExcelRow> {
  // Get workbook session
  const itemPath = encodeURIComponent(filePath);
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${itemPath}:/workbook/worksheets('Feuil1')/usedRange`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

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
  const itemPath = encodeURIComponent(filePath);
  
  // Clear existing data and write new data
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${itemPath}:/workbook/worksheets('Feuil1')/range(address='A1:Q${data.length}')`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: data,
      }),
    }
  );

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
    const { action } = await req.json();

    // Get Microsoft Graph access token
    const accessToken = await getAccessToken();
    const siteId = await getSiteId(accessToken, siteUrl);
    const driveId = await getDriveId(accessToken, siteId);

    if (action === "import" || action === "sync") {
      // Import from Excel to Supabase
      const excelData = await getExcelData(accessToken, siteId, driveId, filePath);
      const rows = excelData.values;

      if (rows.length <= 1) {
        return new Response(
          JSON.stringify({ message: "No data to import (only header row found)", imported: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Skip header row
      const dataRows = rows.slice(1);
      let imported = 0;
      let updated = 0;

      for (const row of dataRows) {
        const projectData = excelRowToProject(row);
        
        if (!projectData.code_projet || !projectData.nom_projet) {
          continue; // Skip rows without required fields
        }

        // Check if project exists
        const { data: existing } = await supabase
          .from("be_projects")
          .select("id")
          .eq("code_projet", projectData.code_projet)
          .single();

        if (existing) {
          // Update existing project
          await supabase
            .from("be_projects")
            .update(projectData)
            .eq("id", existing.id);
          updated++;
        } else {
          // Insert new project
          await supabase.from("be_projects").insert(projectData);
          imported++;
        }
      }

      if (action === "sync") {
        // Also export to Excel (full sync)
        const { data: projects } = await supabase
          .from("be_projects")
          .select("*")
          .order("code_projet");

        if (projects && projects.length > 0) {
          const header = Object.values(COLUMN_MAPPING);
          const excelRows = [header, ...projects.map(projectToExcelRow)];
          await updateExcelData(accessToken, siteId, driveId, filePath, excelRows);
        }
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
      // Export from Supabase to Excel
      const { data: projects, error } = await supabase
        .from("be_projects")
        .select("*")
        .order("code_projet");

      if (error) throw error;

      if (!projects || projects.length === 0) {
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
