import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MICROSOFT_GRAPH_URL = 'https://graph.microsoft.com/v1.0';

// Scopes including Planner
const OAUTH_SCOPES = 'openid profile email offline_access User.Read Calendars.Read Calendars.ReadWrite Mail.Send Tasks.Read Tasks.ReadWrite Group.Read.All';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

function parseJwtExp(accessToken: string): string | null {
  try {
    const parts = accessToken.split('.');
    if (parts.length < 2) return null;
    const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson);
    const exp = payload?.exp;
    if (!exp || typeof exp !== 'number') return null;
    return new Date(exp * 1000).toISOString();
  } catch {
    return null;
  }
}

// Get Azure AD credentials
function getAzureCredentials() {
  const clientId = Deno.env.get('AZURE_CLIENT_ID');
  const tenantId = Deno.env.get('AZURE_TENANT_ID');
  const clientSecret = Deno.env.get('AZURE_CLIENT_SECRET');

  if (!clientId || !tenantId || !clientSecret) {
    throw new Error('Required Azure credentials are not configured');
  }

  return { clientId, clientSecret, tenantId };
}

// Exchange authorization code for tokens
async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse> {
  const { clientId, clientSecret, tenantId } = getAzureCredentials();
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    scope: OAUTH_SCOPES,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Token exchange error:', errorText);
    throw new Error(`Failed to exchange code: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

// Refresh access token
async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret, tenantId } = getAzureCredentials();
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const bodyParams: Record<string, string> = {
    client_id: clientId,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: OAUTH_SCOPES,
  };
  if (clientSecret) bodyParams.client_secret = clientSecret;

  const body = new URLSearchParams(bodyParams);
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Token refresh error:', errorText);
    throw new Error(`Failed to refresh token: ${response.status}`);
  }

  return await response.json();
}

// Get valid access token (refresh if needed)
async function getValidAccessToken(supabase: any, userId: string): Promise<string | null> {
  const { data: connection, error } = await supabase
    .from('user_microsoft_connections')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !connection) return null;

  const now = new Date();
  const expiresAt = new Date(connection.token_expires_at);

  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    if (!connection.refresh_token) return null;

    try {
      const tokens = await refreshAccessToken(connection.refresh_token);
      await supabase
        .from('user_microsoft_connections')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || connection.refresh_token,
          token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        })
        .eq('user_id', userId);
      return tokens.access_token;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return null;
    }
  }

  return connection.access_token;
}

// Fetch calendar events from Microsoft Graph (with pagination)
async function fetchCalendarEvents(accessToken: string, startDate: string, endDate: string): Promise<any[]> {
  const allEvents: any[] = [];
  let url: string | null = `${MICROSOFT_GRAPH_URL}/me/calendarView?startDateTime=${startDate}&endDateTime=${endDate}&$orderby=start/dateTime&$top=500`;

  while (url) {
    const response: Response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'odata.maxpagesize=500',
      },
    });
    if (!response.ok) throw new Error(`Failed to fetch calendar: ${response.status}`);
    const data: any = await response.json();
    allEvents.push(...(data.value || []));
    url = data['@odata.nextLink'] || null;
  }
  return allEvents;
}

// Send email via Microsoft Graph
async function sendEmail(accessToken: string, to: string[], subject: string, body: string, isHtml = true): Promise<void> {
  const response = await fetch(`${MICROSOFT_GRAPH_URL}/me/sendMail`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: isHtml ? 'HTML' : 'Text', content: body },
        toRecipients: to.map(email => ({ emailAddress: { address: email } })),
      },
      saveToSentItems: true,
    }),
  });
  if (!response.ok) throw new Error(`Failed to send email: ${response.status}`);
}

// Get user profile from Microsoft Graph
async function getUserProfile(accessToken: string): Promise<any> {
  const response = await fetch(`${MICROSOFT_GRAPH_URL}/me`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error(`Failed to get user profile: ${response.status}`);
  return await response.json();
}

// ====== PLANNER API FUNCTIONS ======

// Collect Planner plans: group-owned plans + recent/favorites (covers shared plans & Teams where memberOf filter was too strict).
async function getPlannerPlans(accessToken: string): Promise<any[]> {
  const byPlanId = new Map<
    string,
    { id: string; title: string; groupId: string; groupName: string; createdDateTime?: string }
  >();
  const groupDisplayName = new Map<string, string>();

  async function resolveGroupName(groupId: string): Promise<string> {
    if (!groupId) return 'Groupe';
    const cached = groupDisplayName.get(groupId);
    if (cached) return cached;
    try {
      const resp = await fetch(`${MICROSOFT_GRAPH_URL}/groups/${groupId}?$select=displayName`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (resp.ok) {
        const j = await resp.json();
        const name = j.displayName || 'Groupe';
        groupDisplayName.set(groupId, name);
        return name;
      }
    } catch (e) {
      console.error('getPlannerPlans: resolveGroupName', groupId, e);
    }
    return 'Groupe';
  }

  function addPlan(plan: any, groupId: string, groupName: string) {
    if (!plan?.id) return;
    if (byPlanId.has(plan.id)) return;
    byPlanId.set(plan.id, {
      id: plan.id,
      title: plan.title ?? 'Sans titre',
      groupId,
      groupName: groupName || 'Groupe',
      createdDateTime: plan.createdDateTime,
    });
  }

  // 1) All group memberships (not only Unified). Non–Planner-capable groups return 403/empty — skipped.
  let groupUrl: string | null =
    `${MICROSOFT_GRAPH_URL}/me/memberOf/microsoft.graph.group?$select=id,displayName&$top=100`;
  while (groupUrl) {
    const resp = await fetch(groupUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!resp.ok) {
      console.error('getPlannerPlans: memberOf failed', resp.status, await resp.text());
      break;
    }
    const data: any = await resp.json();
    for (const g of data.value || []) {
      if (!g?.id) continue;
      groupDisplayName.set(g.id, g.displayName || 'Groupe');
    }
    groupUrl = data['@odata.nextLink'] || null;
  }

  // 2) Teams — underlying id is the Microsoft 365 group id (fills gaps when memberOf differs from Teams UX).
  let teamsUrl: string | null = `${MICROSOFT_GRAPH_URL}/me/joinedTeams?$select=id,displayName&$top=100`;
  while (teamsUrl) {
    const resp = await fetch(teamsUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!resp.ok) {
      console.error('getPlannerPlans: joinedTeams failed', resp.status);
      break;
    }
    const data: any = await resp.json();
    for (const t of data.value || []) {
      if (!t?.id) continue;
      if (!groupDisplayName.has(t.id)) groupDisplayName.set(t.id, t.displayName || 'Équipe');
    }
    teamsUrl = data['@odata.nextLink'] || null;
  }

  for (const [gid, gname] of groupDisplayName) {
    try {
      const resp = await fetch(`${MICROSOFT_GRAPH_URL}/groups/${gid}/planner/plans`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      for (const plan of data.value || []) addPlan(plan, gid, gname);
    } catch (e) {
      console.error(`getPlannerPlans: groups/${gid}/planner/plans`, e);
    }
  }

  // 3) Plans the user actually uses in Planner (includes many “shared with me” cases).
  async function ingestPlannerPlanCollection(startUrl: string) {
    let next: string | null = startUrl;
    while (next) {
      const resp = await fetch(next, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!resp.ok) {
        const hint = await resp.text();
        console.error('getPlannerPlans: planner collection failed', startUrl, resp.status, hint.slice(0, 500));
        break;
      }
      const data: any = await resp.json();
      for (const plan of data.value || []) {
        const owner = typeof plan.owner === 'string' ? plan.owner : '';
        const gname = owner ? await resolveGroupName(owner) : 'Groupe';
        addPlan(plan, owner, gname);
      }
      next = data['@odata.nextLink'] || null;
    }
  }

  await ingestPlannerPlanCollection(`${MICROSOFT_GRAPH_URL}/me/planner/recentPlans`);
  await ingestPlannerPlanCollection(`${MICROSOFT_GRAPH_URL}/me/planner/favoritePlans`);

  return Array.from(byPlanId.values());
}

// Get buckets from a specific plan
async function getPlannerBuckets(accessToken: string, planId: string): Promise<any[]> {
  const resp = await fetch(`${MICROSOFT_GRAPH_URL}/planner/plans/${planId}/buckets`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) throw new Error(`Failed to fetch buckets: ${resp.status}`);
  const data = await resp.json();
  return (data.value || []).map((b: any) => ({ id: b.id, name: b.name, orderHint: b.orderHint, planId: b.planId }));
}

// Get plan details (category descriptions = label names)
async function getPlannerPlanDetails(accessToken: string, planId: string): Promise<any> {
  const resp = await fetch(`${MICROSOFT_GRAPH_URL}/planner/plans/${planId}/details`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    console.error('Failed to fetch plan details:', resp.status);
    return { categoryDescriptions: {} };
  }
  return await resp.json();
}

/** Normalise import_states (TEXT[]) vers les libellés attendus par la sync Planner. */
function normalizeImportStatesFromMapping(raw: unknown): string[] {
  const fallback = ['notStarted', 'inProgress', 'completed'];
  if (!Array.isArray(raw) || raw.length === 0) return [...fallback];
  const mapped = raw
    .map((s) => {
      const t = String(s).trim();
      const lower = t.toLowerCase();
      if (lower === 'notstarted') return 'notStarted';
      if (lower === 'inprogress') return 'inProgress';
      if (lower === 'completed') return 'completed';
      return t;
    })
    .filter((t) => t.length > 0);
  return mapped.length > 0 ? mapped : [...fallback];
}

// Resolve applied categories to label names
function resolveLabels(appliedCategories: Record<string, boolean> | null, categoryDescriptions: Record<string, string>): string[] {
  if (!appliedCategories) return [];
  const defaultNames: Record<string, string> = {
    category1: 'Rose', category2: 'Rouge', category3: 'Jaune',
    category4: 'Vert', category5: 'Bleu', category6: 'Violet',
    category7: 'Bronze', category8: 'Citron vert', category9: 'Aqua',
    category10: 'Gris', category11: 'Argent', category12: 'Marron',
    category13: 'Canneberge', category14: 'Orange', category15: 'Pêche',
    category16: 'Érable', category17: 'Sarcelle', category18: 'Bleu acier',
    category19: 'Ardoise', category20: 'Lilas', category21: 'Aubergine',
    category22: 'Pistache', category23: 'Olive', category24: 'Charbon',
    category25: 'Cuivre',
  };
  const labels: string[] = [];
  for (const [key, applied] of Object.entries(appliedCategories)) {
    if (applied) {
      const name = categoryDescriptions[key] || defaultNames[key] || key;
      labels.push(name);
    }
  }
  return labels;
}

// Get tasks from a specific plan
async function getPlannerTasks(accessToken: string, planId: string): Promise<any[]> {
  const allTasks: any[] = [];
  let url: string | null = `${MICROSOFT_GRAPH_URL}/planner/plans/${planId}/tasks?$top=500`;

  while (url) {
    const resp: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        const retryAfter = resp.headers.get('Retry-After');
        const waitSec = retryAfter ? parseInt(retryAfter, 10) : 60;
        throw new Error(
          `L'API Microsoft Planner est temporairement surchargée (429). Veuillez réessayer dans ${waitSec} secondes.`
        );
      }
      if (resp.status === 401) throw new Error('Token Microsoft expiré ou invalide (401). Reconnectez votre compte Microsoft.');
      if (resp.status === 403) throw new Error("Accès refusé au plan Planner (403). Vérifiez vos permissions.");
      if (resp.status === 404) throw new Error("Plan Planner introuvable (404). Le plan a peut-être été supprimé.");
      throw new Error(`Erreur API Planner: ${resp.status}`);
    }

    const data: any = await resp.json();
    allTasks.push(...(data.value || []));
    url = data['@odata.nextLink'] || null;
  }

  return allTasks;
}

// Resolve Microsoft Graph user IDs to display name and email
async function resolveGraphUsers(accessToken: string, userIds: string[]): Promise<Map<string, { displayName: string; email: string }>> {
  const results = new Map<string, { displayName: string; email: string }>();
  const uniqueIds = [...new Set(userIds)];

  // Resolve users in parallel batches of 5 to avoid serial API calls while
  // staying well within Graph's per-user throttle limits.
  const BATCH = 5;
  for (let i = 0; i < uniqueIds.length; i += BATCH) {
    const chunk = uniqueIds.slice(i, i + BATCH);
    await Promise.all(chunk.map(async (uid) => {
      try {
        const resp = await fetch(`${MICROSOFT_GRAPH_URL}/users/${uid}?$select=displayName,mail,userPrincipalName`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (resp.ok) {
          const user = await resp.json();
          results.set(uid, {
            displayName: user.displayName || '',
            email: (user.mail || user.userPrincipalName || '').toLowerCase(),
          });
        }
      } catch (e) {
        console.error(`Failed to resolve user ${uid}:`, e);
      }
    }));
  }

  return results;
}

// Match a Microsoft user email to a local profile
async function matchEmailToProfile(supabase: any, email: string): Promise<string | null> {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();

  // Try matching via microsoft connection email first
  const { data: msConn } = await supabase
    .from('user_microsoft_connections')
    .select('profile_id')
    .ilike('email', normalized)
    .maybeSingle();

  if (msConn?.profile_id) return msConn.profile_id;

  // Match profile emails stored on app (avoids auth.admin.listUsers pagination/cost)
  const { data: byLovable } = await supabase
    .from('profiles')
    .select('id')
    .ilike('lovable_email', normalized)
    .maybeSingle();
  if (byLovable?.id) return byLovable.id;

  const { data: bySecondary } = await supabase
    .from('profiles')
    .select('id')
    .ilike('secondary_email', normalized)
    .maybeSingle();
  if (bySecondary?.id) return bySecondary.id;

  // Last resort: scan auth users (can be expensive; only when no profile email match)
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data: authData } = await supabase.auth.admin.listUsers({ page, perPage });
    const users = authData?.users || [];
    const matchedUser = users.find((u: any) => (u.email || '').toLowerCase() === normalized);
    if (matchedUser) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', matchedUser.id)
        .maybeSingle();
      return profile?.id || null;
    }
    if (users.length < perPage) break;
    page++;
  }

  return null;
}

/** Normalized email aliases for a profile (Microsoft connection, profile fields, auth email). */
async function collectProfileEmailAliases(supabase: any, profileId: string): Promise<Set<string>> {
  const out = new Set<string>();
  const push = (e: string | null | undefined) => {
    const v = (e || '').trim().toLowerCase();
    if (v) out.add(v);
  };

  const { data: profile } = await supabase
    .from('profiles')
    .select('lovable_email, secondary_email, user_id')
    .eq('id', profileId)
    .maybeSingle();

  if (!profile) return out;

  push(profile.lovable_email);
  push(profile.secondary_email);

  const { data: msRows } = await supabase
    .from('user_microsoft_connections')
    .select('email')
    .eq('profile_id', profileId);
  for (const row of msRows || []) {
    push(row?.email);
  }

  if (profile.user_id) {
    try {
      const { data: userData, error: authErr } = await supabase.auth.admin.getUserById(profile.user_id);
      if (!authErr) push(userData?.user?.email);
    } catch {
      // ignore
    }
  }

  return out;
}

// Get task details (description, checklist)
async function getPlannerTaskDetails(accessToken: string, taskId: string): Promise<any> {
  const resp = await fetch(`${MICROSOFT_GRAPH_URL}/planner/tasks/${taskId}/details`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) throw new Error(`Failed to fetch task details: ${resp.status}`);
  return await resp.json();
}

// Create a task in Planner
async function createPlannerTask(accessToken: string, planId: string, task: any): Promise<any> {
  const resp = await fetch(`${MICROSOFT_GRAPH_URL}/planner/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      planId,
      title: task.title,
      dueDateTime: task.dueDate || null,
      percentComplete: task.percentComplete || 0,
      assignments: task.assignments || {},
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Failed to create planner task: ${resp.status} - ${errText}`);
  }
  return await resp.json();
}

async function fetchPlannerTaskEtag(accessToken: string, taskId: string): Promise<string | undefined> {
  const resp = await fetch(`${MICROSOFT_GRAPH_URL}/planner/tasks/${taskId}?$select=id`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) return undefined;
  const body = await resp.json();
  return body?.['@odata.etag'];
}

// Update a task in Planner. Returns new etag when Graph provides it (required after PATCH for If-Match on later updates).
async function updatePlannerTask(
  accessToken: string,
  taskId: string,
  etag: string,
  updates: any,
): Promise<{ success: true; etag?: string }> {
  const resp = await fetch(`${MICROSOFT_GRAPH_URL}/planner/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'If-Match': etag,
    },
    body: JSON.stringify(updates),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Failed to update planner task: ${resp.status} - ${errText}`);
  }

  const headerEtag = resp.headers.get('ETag') || resp.headers.get('etag') || undefined;
  if (resp.status === 204) {
    if (headerEtag) return { success: true, etag: headerEtag };
    const refetched = await fetchPlannerTaskEtag(accessToken, taskId);
    return { success: true, etag: refetched };
  }

  const body = await resp.json();
  const bodyEtag = body?.['@odata.etag'] || headerEtag;
  return { success: true, etag: bodyEtag };
}

// Map Planner percentComplete to app status
function plannerPercentToStatus(percent: number): string {
  if (percent === 100) return 'done';
  if (percent > 0) return 'in-progress';
  return 'todo';
}

// Map app status to Planner percentComplete
function statusToPlannerPercent(status: string): number {
  switch (status) {
    case 'done':
    case 'validated':
      return 100;
    case 'in-progress':
    case 'pending_validation_1':
    case 'pending_validation_2':
    case 'review':
      return 50;
    default:
      return 0;
  }
}

// Map Planner priority to app priority
function plannerPriorityToApp(priority: number): string {
  if (priority <= 1) return 'urgent';
  if (priority <= 3) return 'high';
  if (priority <= 5) return 'medium';
  return 'low';
}

function appPriorityToPlanner(priority: string): number {
  switch (priority) {
    case 'urgent': return 1;
    case 'high': return 3;
    case 'medium': return 5;
    case 'low': return 9;
    default: return 5;
  }
}

/** Écrit le log de sync ; retire `diagnostics` si la colonne n’existe pas encore (migration non appliquée). */
async function persistPlannerSyncLog(
  supabase: any,
  syncLogId: string | null,
  row: Record<string, unknown>,
): Promise<void> {
  const stripDiag = (r: Record<string, unknown>) => {
    const { diagnostics, ...rest } = r;
    return rest;
  };
  const isDiagColumnMissing = (e: any) => {
    const s = `${e?.message ?? ''}${e?.details ?? ''}${e?.hint ?? ''}`;
    return /diagnostics/i.test(s) || /column .* does not exist/i.test(s);
  };

  try {
    if (syncLogId) {
      let { error } = await supabase.from('planner_sync_logs').update(row).eq('id', syncLogId);
      if (error && row.diagnostics != null && isDiagColumnMissing(error)) {
        ({ error } = await supabase.from('planner_sync_logs').update(stripDiag(row)).eq('id', syncLogId));
      }
      if (error) {
        console.error('planner_sync_logs update failed:', error);
        let { error: insErr } = await supabase.from('planner_sync_logs').insert(row);
        if (insErr && row.diagnostics != null && isDiagColumnMissing(insErr)) {
          ({ error: insErr } = await supabase.from('planner_sync_logs').insert(stripDiag(row)));
        }
        if (insErr) console.error('planner_sync_logs insert failed:', insErr);
      }
    } else {
      let { error: insertErr } = await supabase.from('planner_sync_logs').insert(row);
      if (insertErr && row.diagnostics != null && isDiagColumnMissing(insertErr)) {
        ({ error: insertErr } = await supabase.from('planner_sync_logs').insert(stripDiag(row)));
      }
      if (insertErr) console.error('planner_sync_logs insert (no syncLogId) failed:', insertErr);
    }
  } catch (e) {
    console.error('persistPlannerSyncLog:', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data } = await supabase.auth.getUser(token);
      userId = data?.user?.id || null;
    }

    // ====== EXISTING ACTIONS ======

    if (action === 'get-auth-url') {
      const { clientId, tenantId } = getAzureCredentials();
      const { redirectUri } = params;
      const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
        `client_id=${clientId}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_mode=query` +
        `&scope=${encodeURIComponent(OAUTH_SCOPES)}` +
        `&state=microsoft-${userId || 'anonymous'}`;

      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'exchange-code') {
      if (!userId) throw new Error('User not authenticated');
      const { code, redirectUri } = params;
      const tokens = await exchangeCodeForTokens(code, redirectUri);
      const profile = await getUserProfile(tokens.access_token);

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      const { error } = await supabase
        .from('user_microsoft_connections')
        .upsert({
          user_id: userId,
          profile_id: userProfile?.id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          email: profile.mail || profile.userPrincipalName,
          display_name: profile.displayName,
          is_calendar_sync_enabled: true,
          is_email_sync_enabled: true,
        }, { onConflict: 'user_id' });

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        email: profile.mail || profile.userPrincipalName,
        displayName: profile.displayName,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Connect using Supabase OAuth session tokens (single-consent flow).
    // Client sends provider access/refresh tokens obtained during Supabase sign-in.
    if (action === 'connect-supabase-session') {
      if (!userId) throw new Error('User not authenticated');
      const { access_token, refresh_token } = params as { access_token?: string; refresh_token?: string };
      if (!access_token) throw new Error('Missing provider tokens');

      const profile = await getUserProfile(access_token);
      const expiresAt =
        parseJwtExp(access_token) ?? new Date(Date.now() + 55 * 60 * 1000).toISOString();

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      // Only include refresh_token in the payload when a non-null value is available.
      // Omitting it from the upsert preserves any previously stored refresh_token so
      // that a subsequent page-load (where provider_refresh_token is absent) does not
      // silently wipe the only token we have for background renewal.
      const connectionPayload: Record<string, unknown> = {
        user_id: userId,
        profile_id: userProfile?.id,
        access_token,
        token_expires_at: expiresAt,
        email: profile.mail || profile.userPrincipalName,
        display_name: profile.displayName,
        is_calendar_sync_enabled: true,
        is_email_sync_enabled: true,
      };
      if (refresh_token) {
        connectionPayload.refresh_token = refresh_token;
      }

      const { error } = await supabase
        .from('user_microsoft_connections')
        .upsert(connectionPayload, { onConflict: 'user_id' });

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        connected: true,
        email: profile.mail || profile.userPrincipalName,
        displayName: profile.displayName,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'sync-calendar') {
      if (!userId) throw new Error('User not authenticated');
      const { startDate, endDate } = params;
      const accessToken = await getValidAccessToken(supabase, userId);
      if (!accessToken) {
        return new Response(JSON.stringify({ success: false, error: 'No valid Microsoft connection' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const events = await fetchCalendarEvents(accessToken, startDate, endDate);
      for (const event of events) {
        await supabase.from('outlook_calendar_events').upsert({
          user_id: userId,
          outlook_event_id: event.id,
          subject: event.subject,
          start_time: event.start?.dateTime,
          end_time: event.end?.dateTime,
          location: event.location?.displayName,
          is_all_day: event.isAllDay,
          organizer_email: event.organizer?.emailAddress?.address,
          attendees: event.attendees,
        }, { onConflict: 'user_id,outlook_event_id' });
      }
      await supabase.from('user_microsoft_connections').update({ last_sync_at: new Date().toISOString() }).eq('user_id', userId);

      return new Response(JSON.stringify({ success: true, syncedEvents: events.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get-calendar-events') {
      if (!userId) throw new Error('User not authenticated');
      const { startDate, endDate, includeSubordinates } = params;
      let query = supabase.from('outlook_calendar_events').select('*').gte('start_time', startDate).lte('end_time', endDate).order('start_time');
      if (includeSubordinates) {
        // Get subordinate user IDs to scope the query
        const subordinateIds = await getSubordinateUserIds(supabase, userId);
        query = query.in('user_id', [userId, ...subordinateIds]);
      } else {
        query = query.eq('user_id', userId);
      }
      const { data: events, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify({ events }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'send-email') {
      if (!userId) throw new Error('User not authenticated');
      const { to, subject, body, isHtml } = params;
      const accessToken = await getValidAccessToken(supabase, userId);
      if (!accessToken) {
        return new Response(JSON.stringify({ success: false, error: 'No valid Microsoft connection' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      await sendEmail(accessToken, to, subject, body, isHtml);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'check-connection') {
      if (!userId) {
        return new Response(JSON.stringify({ connected: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: connection } = await supabase
        .from('user_microsoft_connections')
        .select('email, display_name, is_calendar_sync_enabled, is_email_sync_enabled, last_sync_at')
        .eq('user_id', userId)
        .single();
      return new Response(JSON.stringify({ connected: !!connection, ...connection }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'disconnect') {
      if (!userId) throw new Error('User not authenticated');
      await supabase.from('user_microsoft_connections').delete().eq('user_id', userId);
      await supabase.from('outlook_calendar_events').delete().eq('user_id', userId);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ====== PLANNER ACTIONS ======

    if (action === 'planner-get-plans') {
      if (!userId) throw new Error('User not authenticated');
      const accessToken = await getValidAccessToken(supabase, userId);
      if (!accessToken) {
        return new Response(JSON.stringify({ success: false, error: 'No valid Microsoft connection' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const plans = await getPlannerPlans(accessToken);
      return new Response(JSON.stringify({ success: true, plans }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'planner-get-buckets') {
      if (!userId) throw new Error('User not authenticated');
      const accessToken = await getValidAccessToken(supabase, userId);
      if (!accessToken) {
        return new Response(JSON.stringify({ success: false, error: 'No valid Microsoft connection' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { planId } = params;
      const buckets = await getPlannerBuckets(accessToken, planId);
      return new Response(JSON.stringify({ success: true, buckets }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'planner-get-tasks') {
      if (!userId) throw new Error('User not authenticated');
      const accessToken = await getValidAccessToken(supabase, userId);
      if (!accessToken) {
        return new Response(JSON.stringify({ success: false, error: 'No valid Microsoft connection' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { planId } = params;
      const tasks = await getPlannerTasks(accessToken, planId);

      // Enrich with details for each task
      const enrichedTasks = [];
      for (const task of tasks) {
        try {
          const details = await getPlannerTaskDetails(accessToken, task.id);
          enrichedTasks.push({
            ...task,
            description: details.description || '',
            checklist: details.checklist || {},
          });
        } catch {
          enrichedTasks.push({ ...task, description: '', checklist: {} });
        }
      }

      return new Response(JSON.stringify({ success: true, tasks: enrichedTasks }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ────────────────────────────────────────────────────────────────────────
    // PLANNER PREVIEW: returns Planner tasks of a plan, enriched with bucket /
    // assignee info and a flag indicating whether each task is already linked
    // for the current user. Used by the import dialog to let the user pick
    // which tasks to import.
    // ────────────────────────────────────────────────────────────────────────
    if (action === 'planner-preview-tasks') {
      if (!userId) throw new Error('User not authenticated');
      const accessToken = await getValidAccessToken(supabase, userId);
      if (!accessToken) {
        return new Response(JSON.stringify({ success: false, error: 'No valid Microsoft connection' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { planMappingId } = params;
      if (!planMappingId || typeof planMappingId !== 'string') {
        return new Response(JSON.stringify({ success: false, error: 'planMappingId requis' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: mapping, error: mappingError } = await supabase
        .from('planner_plan_mappings')
        .select('*')
        .eq('id', planMappingId)
        .eq('user_id', userId)
        .single();
      if (mappingError || !mapping) {
        return new Response(JSON.stringify({ success: false, error: 'Plan mapping not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const [plannerTasks, buckets] = await Promise.all([
        getPlannerTasks(accessToken, mapping.planner_plan_id),
        getPlannerBuckets(accessToken, mapping.planner_plan_id).catch(() => []),
      ]);

      // Existing linked planner_task_ids across all the user's mappings (avoids
      // proposing tasks already imported in another mapping by the same user).
      const { data: allUserMappings } = await supabase
        .from('planner_plan_mappings')
        .select('id')
        .eq('user_id', userId);
      const allUserMappingIds = (allUserMappings || []).map((m: any) => m.id);
      let linkedPlannerIds = new Set<string>();
      if (allUserMappingIds.length > 0) {
        const { data: links } = await supabase
          .from('planner_task_links')
          .select('planner_task_id')
          .in('plan_mapping_id', allUserMappingIds);
        linkedPlannerIds = new Set((links || []).map((l: any) => l.planner_task_id));
      }

      // Fallback matching: a task without an active link may already exist in the
      // user's tasks (e.g. link was deleted, or task was imported then renamed).
      // We compare by normalized title to avoid recreating duplicates.
      // Strip the optional internal numbering prefix "T-XXX-NNNN — " and trim/lower.
      const normalizeTitle = (raw: string | null | undefined): string => {
        if (!raw) return '';
        let s = String(raw).trim();
        // Remove "T-PERSO-1234 — <id>-/-<bucket>-/-" full legacy prefix
        s = s.replace(/^T-[A-Z]+-\d+ — \d+-\/-[^/]*-\/-/, '');
        // Remove plain "T-XXX-NNNN — " prefix
        s = s.replace(/^T-[A-Z]+-\d+ — /, '');
        return s.trim().toLowerCase();
      };

      const existingTitleSet = new Set<string>();
      try {
        const { data: existingTasks } = await supabase
          .from('tasks')
          .select('title')
          .eq('user_id', userId)
          .not('title', 'is', null)
          .limit(10000);
        for (const row of existingTasks || []) {
          const norm = normalizeTitle((row as any).title);
          if (norm) existingTitleSet.add(norm);
        }
      } catch (_e) {
        // best-effort; if the lookup fails we just fall back to link-based matching
      }

      // Resolve all assignee user IDs in one batch
      const allAssigneeIds: string[] = [];
      for (const pt of plannerTasks) {
        if (pt.assignments) allAssigneeIds.push(...Object.keys(pt.assignments));
      }
      const graphUsers = allAssigneeIds.length > 0
        ? await resolveGraphUsers(accessToken, allAssigneeIds).catch(() => new Map())
        : new Map();

      const bucketById = new Map<string, string>(
        (buckets || []).map((b: any) => [b.id, b.name as string])
      );

      function getStateLabel(percent: number): string {
        if (percent === 100) return 'completed';
        if (percent > 0) return 'inProgress';
        return 'notStarted';
      }

      const items = plannerTasks.map((pt: any) => {
        const assigneeIds = pt.assignments ? Object.keys(pt.assignments) : [];
        const assignees = assigneeIds.map((aid) => {
          const u = graphUsers.get(aid);
          return {
            id: aid,
            email: u?.email || '',
            displayName: u?.displayName || '',
          };
        });
        const percent = typeof pt.percentComplete === 'number' ? pt.percentComplete : 0;
        const linkedById = linkedPlannerIds.has(pt.id);
        const linkedByTitle = !linkedById && existingTitleSet.has(normalizeTitle(pt.title));
        return {
          id: pt.id,
          title: pt.title,
          state: getStateLabel(percent),
          percentComplete: percent,
          bucketId: pt.bucketId || null,
          bucketName: pt.bucketId ? (bucketById.get(pt.bucketId) || null) : null,
          dueDateTime: pt.dueDateTime || null,
          createdDateTime: pt.createdDateTime || null,
          assignees,
          alreadyLinked: linkedById || linkedByTitle,
        };
      });

      return new Response(JSON.stringify({
        success: true,
        tasks: items,
        buckets: (buckets || []).map((b: any) => ({ id: b.id, name: b.name })),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'planner-sync') {
      if (!userId) throw new Error('User not authenticated');
      const accessToken = await getValidAccessToken(supabase, userId);
      if (!accessToken) {
        return new Response(JSON.stringify({ success: false, error: 'No valid Microsoft connection' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { planMappingId, selectedPlannerTaskIds, skipPush } = params as {
        planMappingId?: string;
        selectedPlannerTaskIds?: string[] | null;
        skipPush?: boolean;
      };
      if (!planMappingId || typeof planMappingId !== 'string') {
        return new Response(JSON.stringify({ success: false, error: 'planMappingId requis' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Optional explicit selection: when provided (even empty), restrict the
      // PULL pass to those Planner task ids. `null`/`undefined` keeps the legacy
      // behaviour (import everything that passes filters).
      const selectionSet: Set<string> | null = Array.isArray(selectedPlannerTaskIds)
        ? new Set(selectedPlannerTaskIds)
        : null;

      let tasksPulled = 0;
      let tasksPushed = 0;
      let tasksUpdated = 0;
      const errors: any[] = [];
      let syncLogId: string | null = null;
      // PULL diagnostics (returned to client when sync ends) — helps debug "0 tasks" reports
      let plannerTasksFetched = 0;
      let pullSkippedAlreadyLinked = 0;
      let pullSkippedByState = 0;
      let pullSkippedByDefaultRequesterAssignee = 0;

      try {

      // Get the mapping
      const { data: mapping, error: mappingError } = await supabase
        .from('planner_plan_mappings')
        .select('*')
        .eq('id', planMappingId)
        .eq('user_id', userId)
        .single();

      if (mappingError || !mapping) throw new Error('Plan mapping not found');

      // Create sync log at start so history updates even if sync is interrupted
      // Retry up to 2 times to ensure log is always created
      for (let attempt = 0; attempt < 2 && !syncLogId; attempt++) {
        try {
          const { data: startedLog, error: logError } = await supabase
            .from('planner_sync_logs')
            .insert({
              user_id: userId,
              plan_mapping_id: planMappingId,
              direction: mapping.sync_direction,
              tasks_pushed: 0,
              tasks_pulled: 0,
              tasks_updated: 0,
              errors: [],
              status: 'running',
            })
            .select('id')
            .single();

          if (logError) {
            console.error(`Sync log creation attempt ${attempt + 1} failed:`, logError);
          } else {
            syncLogId = startedLog?.id ?? null;
          }
        } catch (logStartErr) {
          console.error(`Sync log creation attempt ${attempt + 1} error:`, logStartErr);
        }
      }

      const plannerTasks: any[] = await getPlannerTasks(accessToken, mapping.planner_plan_id);
      plannerTasksFetched = plannerTasks.length;
      console.log(`planner-sync: fetched ${plannerTasks.length} tasks from plan ${mapping.planner_plan_id}`);

      // Get bucket mappings for subcategory resolution
      const { data: bucketMappings } = await supabase
        .from('planner_bucket_mappings')
        .select('*')
        .eq('plan_mapping_id', planMappingId);
      const bucketToSubcategory = new Map((bucketMappings || []).map(bm => [bm.planner_bucket_id, bm.mapped_subcategory_id]));

      // Import state filter (tolère null, [], casse incorrecte)
      const importStates: string[] = normalizeImportStatesFromMapping(mapping.import_states);

      // Map Planner percentComplete to state string for filtering
      function getPlannerState(percent: number): string {
        if (percent === 100) return 'completed';
        if (percent > 0) return 'inProgress';
        return 'notStarted';
      }

      function plannerPercentValue(raw: unknown): number {
        if (typeof raw === 'number' && !Number.isNaN(raw)) return raw;
        const n = parseInt(String(raw ?? ''), 10);
        return Number.isFinite(n) ? n : 0;
      }

      // Get existing links for THIS mapping (used for UPDATE loop + local task prefetch)
      const { data: existingLinks } = await supabase
        .from('planner_task_links')
        .select('*')
        .eq('plan_mapping_id', planMappingId);

      // Dedup: planner_task_ids already linked under THIS user's mappings.
      // Scoped to the current user so that different users can each import tasks
      // from the same shared Planner plan into their own local task set.
      const { data: allUserMappings } = await supabase
        .from('planner_plan_mappings')
        .select('id')
        .eq('user_id', userId);
      const allUserMappingIds = (allUserMappings || []).map((m: any) => m.id);

      let linkedPlannerIds = new Set<string>();
      if (allUserMappingIds.length > 0) {
        const { data: allPlannerLinks, error: allLinksErr } = await supabase
          .from('planner_task_links')
          .select('planner_task_id')
          .in('plan_mapping_id', allUserMappingIds);
        if (allLinksErr) {
          console.error('planner-sync: failed to load planner_task_links for user mappings', allLinksErr);
        }
        linkedPlannerIds = new Set((allPlannerLinks || []).map((l: { planner_task_id: string }) => l.planner_task_id));
      }
      const linkedLocalIds = new Set((existingLinks || []).map(l => l.local_task_id));

      console.log(`planner-sync: ${linkedPlannerIds.size} tasks already linked (user scope), ${existingLinks?.length || 0} links for this mapping`);

      // Prefetch all linked local tasks once to avoid N+1 queries
      const localTaskIds = [...new Set((existingLinks || []).map(l => l.local_task_id).filter(Boolean))];
      const localTasksById = new Map<string, any>();
      if (localTaskIds.length > 0) {
        const { data: linkedLocalTasks } = await supabase
          .from('tasks')
          .select('*')
          .in('id', localTaskIds);

        for (const localTask of linkedLocalTasks || []) {
          localTasksById.set(localTask.id, localTask);
        }
      }

      // Get plan details for label names
      let categoryDescriptions: Record<string, string> = {};
      try {
        const planDetails = await getPlannerPlanDetails(accessToken, mapping.planner_plan_id);
        categoryDescriptions = planDetails.categoryDescriptions || {};
      } catch (e) {
        console.error('Failed to fetch plan details for labels:', e);
      }

      // Get user's profile_id
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      // When default requester is set, optionally restrict NEW imports to Planner tasks where at least
      // one Graph assignee email matches that profile's known emails (avoids bulk-importing legacy plans).
      let defaultRequesterEmails: Set<string> | null = null;
      if (mapping.default_requester_id) {
        const aliases = await collectProfileEmailAliases(supabase, mapping.default_requester_id);
        if (aliases.size > 0) {
          defaultRequesterEmails = aliases;
        } else {
          console.warn(
            'planner-sync: default_requester_id is set but no email aliases resolved; import assignee filter disabled',
          );
        }
      }

      // Resolve Planner assignees if enabled, or when we need Graph emails for default-requester import filter
      const resolveAssignees = mapping.resolve_assignees !== false;
      const graphUserCache = new Map<string, { displayName: string; email: string }>();
      const profileCache = new Map<string, string | null>(); // email -> profile_id

      const needGraphAssigneeEmails = !!(defaultRequesterEmails && defaultRequesterEmails.size > 0);
      if (resolveAssignees || needGraphAssigneeEmails) {
        // Collect all unique assignee IDs from planner tasks
        const allAssigneeIds: string[] = [];
        for (const pt of plannerTasks) {
          if (pt.assignments) {
            allAssigneeIds.push(...Object.keys(pt.assignments));
          }
        }

        if (allAssigneeIds.length > 0) {
          const resolved = await resolveGraphUsers(accessToken, allAssigneeIds);
          resolved.forEach((v, k) => graphUserCache.set(k, v));
        }
      }

      // Helper to get local profile_id from Planner assignees.
      // Iterates ALL assignees (not just the first) and returns the first one
      // that resolves to a local profile. If none resolve, returns null profileId
      // with the first assignee's info for traceability.
      async function resolveAssigneeToProfile(plannerTask: any): Promise<{ profileId: string | null; email: string; displayName: string }> {
        if (!resolveAssignees || !plannerTask.assignments) {
          return { profileId: null, email: '', displayName: '' };
        }
        
        const assigneeIds = Object.keys(plannerTask.assignments);
        if (assigneeIds.length === 0) return { profileId: null, email: '', displayName: '' };
        
        let firstEmail = '';
        let firstDisplayName = '';

        for (const graphUserId of assigneeIds) {
          const graphUser = graphUserCache.get(graphUserId);
          if (!graphUser) continue;

          if (!firstEmail) {
            firstEmail = graphUser.email;
            firstDisplayName = graphUser.displayName;
          }

          if (!profileCache.has(graphUser.email)) {
            const pid = await matchEmailToProfile(supabase, graphUser.email);
            profileCache.set(graphUser.email, pid);
          }

          const resolvedId = profileCache.get(graphUser.email);
          if (resolvedId) {
            return {
              profileId: resolvedId,
              email: graphUser.email,
              displayName: graphUser.displayName,
            };
          }
        }

        return {
          profileId: null,
          email: firstEmail,
          displayName: firstDisplayName,
        };
      }

      // PULL: Import new planner tasks
      if (mapping.sync_direction === 'from_planner' || mapping.sync_direction === 'both') {
        for (const pt of plannerTasks) {
          if (linkedPlannerIds.has(pt.id)) { pullSkippedAlreadyLinked++; continue; }

          // Explicit user selection (modal preview): only import these ids
          if (selectionSet && !selectionSet.has(pt.id)) {
            pullSkippedByState++; // reuse counter so the user sees "filtered out"
            continue;
          }

          // Filter by state
          const taskState = getPlannerState(plannerPercentValue(pt.percentComplete));
          if (!importStates.includes(taskState)) { pullSkippedByState++; continue; }

          // Optional: only import tasks whose Planner assignees include someone whose Graph email
          // matches the default requester. If Graph did not return any email for those assignees,
          // do NOT skip (otherwise every task is excluded and sync stays at 0).
          if (defaultRequesterEmails && defaultRequesterEmails.size > 0) {
            const assigneeIds = pt.assignments ? Object.keys(pt.assignments) : [];
            if (assigneeIds.length > 0) {
              const resolvedEmails = assigneeIds
                .map((aid) => (graphUserCache.get(aid)?.email || '').trim().toLowerCase())
                .filter(Boolean);
              if (resolvedEmails.length > 0) {
                const anyMatch = resolvedEmails.some((em) => defaultRequesterEmails!.has(em));
                if (!anyMatch) {
                  pullSkippedByDefaultRequesterAssignee++;
                  continue;
                }
              }
            }
          }

          try {
            // ─── DUPLICATE PREVENTION: fallback matching by exact title ──────
            // Some legacy tasks were imported without a planner_task_link.
            // Before creating a new task, check if a task with the exact Planner
            // title (or a previously-renamed variant carrying that title in its
            // suffix) already exists for this user. If so, just create the link
            // and treat it as "already linked" — never create a duplicate row.
            const titleVariants = [
              pt.title,
              // legacy renamed format: "T-XXX-NNNN — <ID>-/-<bucket>-/-<title>"
              `%-/-${pt.title}`,
              // legacy renamed format: "T-XXX-NNNN — <title>"
              `T-%-_____ — ${pt.title}`,
            ];

            const { data: titleMatches } = await supabase
              .from('tasks')
              .select('id, title')
              .eq('user_id', userId)
              .or(
                [
                  `title.eq.${pt.title.replace(/,/g, '\\,')}`,
                  `title.ilike.%-/-${pt.title.replace(/,/g, '\\,')}`,
                  `title.ilike.T-%— ${pt.title.replace(/,/g, '\\,')}`,
                ].join(','),
              )
              .limit(5);

            const existingMatch =
              Array.isArray(titleMatches) && titleMatches.length > 0
                ? titleMatches.find((t) => !linkedLocalIds.has(t.id)) || titleMatches[0]
                : null;

            if (existingMatch && !linkedLocalIds.has(existingMatch.id)) {
              // Link the existing task instead of creating a new one.
              // Upsert sur la cle composite (plan_mapping_id, planner_task_id) pour
              // rester idempotent en cas de re-synchronisation.
              const { error: backlinkErr } = await supabase
                .from('planner_task_links')
                .upsert(
                  {
                    plan_mapping_id: planMappingId,
                    planner_task_id: pt.id,
                    local_task_id: existingMatch.id,
                    planner_etag: pt['@odata.etag'],
                    sync_status: 'synced',
                    last_synced_at: new Date().toISOString(),
                  },
                  { onConflict: 'plan_mapping_id,planner_task_id' },
                );
              if (!backlinkErr) {
                linkedPlannerIds.add(pt.id);
                linkedLocalIds.add(existingMatch.id);
                pullSkippedAlreadyLinked++;
                console.log(
                  `planner-sync PULL: linked existing task ${existingMatch.id} to planner task ${pt.id} via title match`,
                );
                continue;
              }
              // If link insert failed (e.g. unique violation), still skip creation
              console.warn('planner-sync PULL: title fallback link insert failed', backlinkErr);
            }
            // ─────────────────────────────────────────────────────────────────

            const status = mapping.default_status || plannerPercentToStatus(pt.percentComplete || 0);
            const priority = mapping.default_priority || plannerPriorityToApp(pt.priority || 5);

            // Resolve subcategory from bucket mapping
            const subcategoryId = pt.bucketId ? bucketToSubcategory.get(pt.bucketId) : null;

            // Resolve Planner labels
            const plannerLabels = resolveLabels(pt.appliedCategories || null, categoryDescriptions);

            // Resolve assignee from Planner.
            // Only fall back to syncing user when the task has NO Planner assignees
            // (truly unassigned). When assignees exist but none can be resolved to
            // a local profile, leave assignee_id null to avoid incorrectly claiming
            // ownership of tasks assigned to people outside the app.
            const assigneeInfo = await resolveAssigneeToProfile(pt);
            const hasPlannerAssignees = pt.assignments && Object.keys(pt.assignments).length > 0;
            const assigneeId = assigneeInfo.profileId || (hasPlannerAssignees ? null : userProfile?.id);

            // Fetch Planner note details only for tasks that will be imported
            let plannerDescription: string | null = null;
            try {
              const details = await getPlannerTaskDetails(accessToken, pt.id);
              plannerDescription = details.description || null;
            } catch {
              plannerDescription = null;
            }

            const { data: newTask, error: insertErr } = await supabase
              .from('tasks')
              .insert({
                title: pt.title,
                description: plannerDescription,
                status,
                priority,
                due_date: pt.dueDateTime ? pt.dueDateTime.substring(0, 10) : null,
                type: 'task',
                user_id: userId,
                assignee_id: assigneeId,
                requester_id: mapping.default_requester_id || null,
                reporter_id: mapping.default_reporter_id || null,
                category_id: mapping.mapped_category_id,
                subcategory_id: subcategoryId || null,
                source_process_template_id: mapping.mapped_process_template_id,
                planner_labels: plannerLabels.length > 0 ? plannerLabels : null,
                date_demande: pt.createdDateTime || null,
                date_lancement: pt.startDateTime ? pt.startDateTime : null,
                date_fermeture: pt.completedDateTime
                  ? pt.completedDateTime
                  : ((status === 'done' || status === 'validated') ? (pt.createdDateTime || null) : null),
              })
              .select()
              .single();

            if (insertErr) throw insertErr;

            // Sync planner labels to service_group_labels via task_labels junction
            if (plannerLabels.length > 0 && mapping.mapped_process_template_id) {
              try {
                // Get service_group_id from process template
                const { data: ptData } = await supabase
                  .from('process_templates')
                  .select('service_group_id')
                  .eq('id', mapping.mapped_process_template_id)
                  .single();
                
                if (ptData?.service_group_id) {
                  // Find matching service_group_labels by name
                  const { data: sgLabels } = await supabase
                    .from('service_group_labels')
                    .select('id, name')
                    .eq('service_group_id', ptData.service_group_id)
                    .eq('is_active', true);
                  
                  if (sgLabels && sgLabels.length > 0) {
                    const labelInserts = plannerLabels
                      .map(plName => sgLabels.find(sgl => sgl.name.toLowerCase() === plName.toLowerCase()))
                      .filter(Boolean)
                      .map(sgl => ({ task_id: newTask.id, label_id: sgl!.id }));
                    
                    if (labelInserts.length > 0) {
                      await supabase.from('task_labels').upsert(labelInserts, { onConflict: 'task_id,label_id' });
                    }
                  }
                }
              } catch (labelErr) {
                console.error('Failed to sync task labels:', labelErr);
              }
            }

            // Idempotent upsert sur (plan_mapping_id, planner_task_id) : si un
            // lien existait deja pour ce planner_task_id dans ce mapping (race ou
            // re-sync), on met a jour le lien existant et on supprime la nouvelle
            // tache locale qui vient d'etre creee pour eviter un orphelin.
            const { data: linkRows, error: linkErr } = await supabase
              .from('planner_task_links')
              .upsert(
                {
                  plan_mapping_id: planMappingId,
                  planner_task_id: pt.id,
                  local_task_id: newTask.id,
                  planner_etag: pt['@odata.etag'],
                  sync_status: 'synced',
                  planner_assignee_email: assigneeInfo.email || null,
                  planner_assignee_name: assigneeInfo.displayName || null,
                  last_synced_at: new Date().toISOString(),
                },
                { onConflict: 'plan_mapping_id,planner_task_id' },
              )
              .select('local_task_id');

            if (linkErr) {
              // Roll back the task row to avoid leaving an unlinked orphan.
              await supabase.from('tasks').delete().eq('id', newTask.id);
              throw linkErr;
            }

            const finalLocalId = linkRows?.[0]?.local_task_id ?? newTask.id;
            if (finalLocalId !== newTask.id) {
              // Le lien pointait deja vers une autre tache locale : on supprime
              // la tache fraichement creee pour ne pas laisser d'orphelin.
              await supabase.from('tasks').delete().eq('id', newTask.id);
            }

            linkedPlannerIds.add(pt.id);
            linkedLocalIds.add(newTask.id);

            tasksPulled++;
          } catch (err: any) {
            errors.push({ plannerTaskId: pt.id, error: err.message });
          }
        }

        console.log(
          `planner-sync PULL: ${tasksPulled} imported, ${pullSkippedAlreadyLinked} already linked, ${pullSkippedByState} filtered by state (importStates=${importStates.join(',')}), ${pullSkippedByDefaultRequesterAssignee} skipped (assignee emails resolved but none match default requester)`,
        );
      }

      // UPDATE: Sync existing linked tasks (only rows that were linked at sync start; PULL additions are handled next run).
      // Order for `both`: Planner → local first, then local → Planner for percent/priority/due so app changes to those fields win.
      for (const link of (existingLinks || [])) {
        const plannerTask = plannerTasks.find(t => t.id === link.planner_task_id);
        if (!plannerTask) continue;

        try {
          const localTask = localTasksById.get(link.local_task_id);
          if (!localTask) continue;

          let etagForLink = plannerTask['@odata.etag'] as string;

          // If both sides are already finished, nothing to sync — just refresh the stored etag and move on.
          const localIsDone = ['done', 'validated'].includes(localTask.status);
          const plannerIsDone = (plannerTask.percentComplete || 0) === 100;
          if (localIsDone && plannerIsDone) {
            await supabase.from('planner_task_links').update({
              planner_etag: etagForLink,
              last_synced_at: new Date().toISOString(),
              sync_status: 'synced',
            }).eq('id', link.id);
            continue;
          }

          // Etag short-circuit: if Planner task is unchanged since last sync, skip the
          // details fetch and all pull-direction field diffs (saves one Graph API call per task).
          const plannerTaskUnchanged = !!link.planner_etag && plannerTask['@odata.etag'] === link.planner_etag;

          // Pull updates from Planner
          if (mapping.sync_direction === 'from_planner' || mapping.sync_direction === 'both') {
            let plannerNotesDescription: string | null = null;
            if (!plannerTaskUnchanged) {
              try {
                const details = await getPlannerTaskDetails(accessToken, plannerTask.id);
                plannerNotesDescription = details.description ?? null;
              } catch {
                plannerNotesDescription = null;
              }
            }

            // Compute label names once — used for both field diff and junction table sync.
            const newLabels = resolveLabels(plannerTask.appliedCategories || null, categoryDescriptions);

            if (!plannerTaskUnchanged) {
              const plannerStatus = plannerPercentToStatus(plannerTask.percentComplete || 0);
              const plannerPriority = plannerPriorityToApp(plannerTask.priority || 5);

              const updates: any = {};
              if (plannerStatus !== localTask.status) updates.status = plannerStatus;
              if (plannerPriority !== localTask.priority) updates.priority = plannerPriority;
              if (plannerTask.dueDateTime) {
                const dueDate = plannerTask.dueDateTime.substring(0, 10);
                if (dueDate !== localTask.due_date) updates.due_date = dueDate;
              }

              // Sync date_demande from Planner createdDateTime (overwrite if incorrect)
              if (plannerTask.createdDateTime && plannerTask.createdDateTime !== localTask.date_demande) {
                updates.date_demande = plannerTask.createdDateTime;
              }

              // Sync date_lancement from Planner startDateTime (overwrite if incorrect)
              if (plannerTask.startDateTime && plannerTask.startDateTime !== localTask.date_lancement) {
                updates.date_lancement = plannerTask.startDateTime;
              }

              // Sync date_fermeture from Planner completedDateTime
              if (plannerTask.completedDateTime) {
                if (plannerTask.completedDateTime !== localTask.date_fermeture) {
                  updates.date_fermeture = plannerTask.completedDateTime;
                }
              } else if (!localTask.date_fermeture && plannerStatus === 'done' && plannerTask.createdDateTime) {
                // Fallback when Planner task is completed but completion timestamp is unavailable
                updates.date_fermeture = plannerTask.createdDateTime;
              } else if (plannerStatus !== 'done' && plannerStatus !== 'validated' && localTask.date_fermeture) {
                // Re-opened in Planner: clear local closure date
                updates.date_fermeture = null;
              }

              const currentLabels = localTask.planner_labels || [];
              if (JSON.stringify(newLabels.sort()) !== JSON.stringify([...currentLabels].sort())) {
                updates.planner_labels = newLabels.length > 0 ? newLabels : null;
              }

              if (plannerNotesDescription !== null && plannerNotesDescription !== (localTask.description || '')) {
                updates.description = plannerNotesDescription;
              }

              if (Object.keys(updates).length > 0) {
                await supabase.from('tasks').update(updates).eq('id', link.local_task_id);
                localTasksById.set(link.local_task_id, { ...localTask, ...updates });
                tasksUpdated++;
              }
            } // end !plannerTaskUnchanged

            // Sync planner labels to task_labels junction table
            if (!plannerTaskUnchanged && newLabels.length > 0 && mapping.mapped_process_template_id) {
              try {
                const { data: ptData } = await supabase
                  .from('process_templates')
                  .select('service_group_id')
                  .eq('id', mapping.mapped_process_template_id)
                  .single();

                if (ptData?.service_group_id) {
                  const { data: sgLabels } = await supabase
                    .from('service_group_labels')
                    .select('id, name')
                    .eq('service_group_id', ptData.service_group_id)
                    .eq('is_active', true);

                  if (sgLabels && sgLabels.length > 0) {
                    // Remove existing task_labels for this task
                    await supabase.from('task_labels').delete().eq('task_id', link.local_task_id);

                    const labelInserts = newLabels
                      .map(plName => sgLabels.find(sgl => sgl.name.toLowerCase() === plName.toLowerCase()))
                      .filter(Boolean)
                      .map(sgl => ({ task_id: link.local_task_id, label_id: sgl!.id }));

                    if (labelInserts.length > 0) {
                      await supabase.from('task_labels').insert(labelInserts);
                    }
                  }
                }
              } catch (labelErr) {
                console.error('Failed to sync task labels on update:', labelErr);
              }
            }
          }

          // Push updates to Planner
          if (mapping.sync_direction === 'to_planner' || mapping.sync_direction === 'both') {
            const localForPush = localTasksById.get(link.local_task_id) ?? localTask;
            const localPercent = statusToPlannerPercent(localForPush.status);
            const localPlannerPriority = appPriorityToPlanner(localForPush.priority || 'medium');

            const plannerUpdates: any = {};
            if (localPercent !== (plannerTask.percentComplete || 0)) plannerUpdates.percentComplete = localPercent;
            if (localPlannerPriority !== (plannerTask.priority || 5)) plannerUpdates.priority = localPlannerPriority;
            if (localForPush.due_date && localForPush.due_date !== (plannerTask.dueDateTime || '').substring(0, 10)) {
              plannerUpdates.dueDateTime = localForPush.due_date + 'T00:00:00Z';
            }

            if (Object.keys(plannerUpdates).length > 0) {
              try {
                const patchResult = await updatePlannerTask(
                  accessToken,
                  plannerTask.id,
                  etagForLink,
                  plannerUpdates,
                );
                if (patchResult.etag) etagForLink = patchResult.etag;
                tasksUpdated++;
              } catch (err: any) {
                errors.push({ plannerTaskId: plannerTask.id, error: err.message });
              }
            }
          }

          // Update link
          await supabase.from('planner_task_links').update({
            planner_etag: etagForLink,
            last_synced_at: new Date().toISOString(),
            sync_status: 'synced',
          }).eq('id', link.id);

        } catch (err: any) {
          errors.push({ plannerTaskId: link.planner_task_id, error: err.message });
        }
      }

      // PUSH: Push local unlinked tasks to Planner (skipped when caller asks for import-only)
      if (!skipPush && (mapping.sync_direction === 'to_planner' || mapping.sync_direction === 'both')) {
        // Only push active tasks — finished tasks have no value in Planner and would flood the plan.
        let localQuery = supabase.from('tasks').select('*')
          .eq('user_id', userId)
          .eq('type', 'task')
          .not('status', 'in', '("done","validated","refused","cloture")');
        if (mapping.mapped_category_id) localQuery = localQuery.eq('category_id', mapping.mapped_category_id);

        const { data: localTasks } = await localQuery;

        for (const lt of (localTasks || [])) {
          if (linkedLocalIds.has(lt.id)) continue;

          try {
            const created = await createPlannerTask(accessToken, mapping.planner_plan_id, {
              title: lt.title,
              dueDate: lt.due_date ? lt.due_date + 'T00:00:00Z' : null,
              percentComplete: statusToPlannerPercent(lt.status),
            });

            await supabase
              .from('planner_task_links')
              .upsert(
                {
                  plan_mapping_id: planMappingId,
                  planner_task_id: created.id,
                  local_task_id: lt.id,
                  planner_etag: created['@odata.etag'],
                  sync_status: 'synced',
                  last_synced_at: new Date().toISOString(),
                },
                { onConflict: 'plan_mapping_id,planner_task_id' },
              );

            linkedLocalIds.add(lt.id);

            tasksPushed++;
          } catch (err: any) {
            errors.push({ localTaskId: lt.id, error: err.message });
          }
        }
      }

      // Update mapping
      await supabase.from('planner_plan_mappings').update({ last_sync_at: new Date().toISOString() }).eq('id', planMappingId);

      const firstPt = plannerTasks[0];
      const firstDerivedState = firstPt
        ? getPlannerState(plannerPercentValue(firstPt.percentComplete))
        : null;
      const syncDiagnosticsPayload = {
        plannerTasksFetched,
        pullSkippedAlreadyLinked,
        pullSkippedByState,
        pullSkippedByDefaultRequesterAssignee,
        importStatesUsed: importStates,
        importStatesRaw: mapping.import_states,
        syncDirection: mapping.sync_direction,
        defaultRequesterFilterActive: !!(defaultRequesterEmails && defaultRequesterEmails.size > 0),
        graphUsersResolved: graphUserCache.size,
        sampleFirstTask: firstPt
          ? {
            id: firstPt.id,
            percentComplete: firstPt.percentComplete,
            derivedState: firstDerivedState,
            stateFilterIncludes: firstDerivedState ? importStates.includes(firstDerivedState) : false,
            alreadyLinkedForUser: linkedPlannerIds.has(firstPt.id),
          }
          : null,
        sampleErrors: errors.slice(0, 5),
      };

      // Finalize sync log - ensure it's always written
      const finalLogData = {
        user_id: userId,
        plan_mapping_id: planMappingId,
        direction: mapping.sync_direction,
        tasks_pushed: tasksPushed,
        tasks_pulled: tasksPulled,
        tasks_updated: tasksUpdated,
        errors,
        status: errors.length > 0 ? 'partial' : 'success',
        diagnostics: syncDiagnosticsPayload,
      };

      await persistPlannerSyncLog(supabase, syncLogId, finalLogData);

      return new Response(JSON.stringify({
        success: true,
        tasksPulled,
        tasksPushed,
        tasksUpdated,
        errors: errors.length,
        diagnostics: syncDiagnosticsPayload,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      } catch (syncErr: any) {
        // Always write sync log even on error
        console.error('Planner sync error:', syncErr);
        errors.push({ error: syncErr.message });
        
        try {
          if (syncLogId) {
            await supabase.from('planner_sync_logs').update({
              tasks_pushed: tasksPushed,
              tasks_pulled: tasksPulled,
              tasks_updated: tasksUpdated,
              errors,
              status: 'error',
            }).eq('id', syncLogId);
          } else {
            await supabase.from('planner_sync_logs').insert({
              user_id: userId,
              plan_mapping_id: planMappingId,
              direction: 'from_planner',
              tasks_pushed: tasksPushed,
              tasks_pulled: tasksPulled,
              tasks_updated: tasksUpdated,
              errors,
              status: 'error',
            });
          }
        } catch (logErr) {
          console.error('Failed to write sync log:', logErr);
        }

        return new Response(JSON.stringify({
          success: false,
          error: syncErr.message,
          tasksPulled,
          tasksPushed,
          tasksUpdated,
          errors: errors.length,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: any) {
    console.error('Microsoft Graph error:', error);
    return new Response(JSON.stringify({ error: 'An internal error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper: get all subordinate user IDs (recursive) for calendar access scoping
async function getSubordinateUserIds(supabase: any, userId: string): Promise<string[]> {
  // Get the profile of the requesting user
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!myProfile) return [];

  // Recursively find subordinates via manager_id chain
  const subordinateUserIds: string[] = [];
  const queue = [myProfile.id];

  while (queue.length > 0) {
    const managerId = queue.shift()!;
    const { data: directReports } = await supabase
      .from('profiles')
      .select('id, user_id')
      .eq('manager_id', managerId);

    if (directReports) {
      for (const report of directReports) {
        if (report.user_id) subordinateUserIds.push(report.user_id);
        queue.push(report.id);
      }
    }
  }

  return subordinateUserIds;
}
