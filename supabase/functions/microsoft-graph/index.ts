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

// Get all plans the user is member of
async function getPlannerPlans(accessToken: string): Promise<any[]> {
  const allPlans: any[] = [];

  // Get groups the user is member of
  let groupUrl: string | null = `${MICROSOFT_GRAPH_URL}/me/memberOf/microsoft.graph.group?$filter=groupTypes/any(g:g eq 'Unified')&$select=id,displayName&$top=100`;

  const groups: any[] = [];
  while (groupUrl) {
    const resp: Response = await fetch(groupUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!resp.ok) {
      console.error('Failed to fetch groups:', resp.status);
      break;
    }
    const data: any = await resp.json();
    groups.push(...(data.value || []));
    groupUrl = data['@odata.nextLink'] || null;
  }

  // For each group, get its plans
  for (const group of groups) {
    try {
      const resp = await fetch(`${MICROSOFT_GRAPH_URL}/groups/${group.id}/planner/plans`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        for (const plan of (data.value || [])) {
          allPlans.push({
            id: plan.id,
            title: plan.title,
            groupId: group.id,
            groupName: group.displayName,
            createdDateTime: plan.createdDateTime,
          });
        }
      }
    } catch (e) {
      console.error(`Error fetching plans for group ${group.id}:`, e);
    }
  }

  return allPlans;
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
    if (!resp.ok) throw new Error(`Failed to fetch planner tasks: ${resp.status}`);
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
  
  for (const uid of uniqueIds) {
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
  }
  
  return results;
}

// Match a Microsoft user email to a local profile
async function matchEmailToProfile(supabase: any, email: string): Promise<string | null> {
  if (!email) return null;
  
  // Try matching via microsoft connection email first
  const { data: msConn } = await supabase
    .from('user_microsoft_connections')
    .select('profile_id')
    .ilike('email', email)
    .single();
  
  if (msConn?.profile_id) return msConn.profile_id;

  // Fallback: match via auth user email -> profile
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const matchedUser = (authUsers?.users || []).find(
    (u: any) => u.email?.toLowerCase() === email.toLowerCase()
  );
  
  if (matchedUser) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', matchedUser.id)
      .single();
    return profile?.id || null;
  }
  
  return null;
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

// Update a task in Planner
async function updatePlannerTask(accessToken: string, taskId: string, etag: string, updates: any): Promise<any> {
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
  // PATCH returns 204 No Content on success
  if (resp.status === 204) return { success: true };
  return await resp.json();
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

    if (action === 'planner-sync') {
      if (!userId) throw new Error('User not authenticated');
      const accessToken = await getValidAccessToken(supabase, userId);
      if (!accessToken) {
        return new Response(JSON.stringify({ success: false, error: 'No valid Microsoft connection' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { planMappingId } = params;
      let tasksPulled = 0;
      let tasksPushed = 0;
      let tasksUpdated = 0;
      const errors: any[] = [];
      let syncLogId: string | null = null;

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

      // Get bucket mappings for subcategory resolution
      const { data: bucketMappings } = await supabase
        .from('planner_bucket_mappings')
        .select('*')
        .eq('plan_mapping_id', planMappingId);
      const bucketToSubcategory = new Map((bucketMappings || []).map(bm => [bm.planner_bucket_id, bm.mapped_subcategory_id]));

      // Import state filter
      const importStates: string[] = mapping.import_states || ['notStarted', 'inProgress', 'completed'];

      // Map Planner percentComplete to state string for filtering
      function getPlannerState(percent: number): string {
        if (percent === 100) return 'completed';
        if (percent > 0) return 'inProgress';
        return 'notStarted';
      }

      // Get existing links
      const { data: existingLinks } = await supabase
        .from('planner_task_links')
        .select('*')
        .eq('plan_mapping_id', planMappingId);

      const linkedPlannerIds = new Set((existingLinks || []).map(l => l.planner_task_id));
      const linkedLocalIds = new Set((existingLinks || []).map(l => l.local_task_id));

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

      // Resolve Planner assignees if enabled
      const resolveAssignees = mapping.resolve_assignees !== false;
      const graphUserCache = new Map<string, { displayName: string; email: string }>();
      const profileCache = new Map<string, string | null>(); // email -> profile_id

      if (resolveAssignees) {
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

      // Helper to get local profile_id from a Planner assignee
      async function resolveAssigneeToProfile(plannerTask: any): Promise<{ profileId: string | null; email: string; displayName: string }> {
        if (!resolveAssignees || !plannerTask.assignments) {
          return { profileId: null, email: '', displayName: '' };
        }
        
        const assigneeIds = Object.keys(plannerTask.assignments);
        if (assigneeIds.length === 0) return { profileId: null, email: '', displayName: '' };
        
        // Take the first assignee
        const graphUserId = assigneeIds[0];
        const graphUser = graphUserCache.get(graphUserId);
        if (!graphUser) return { profileId: null, email: '', displayName: '' };
        
        // Check cache
        if (!profileCache.has(graphUser.email)) {
          const pid = await matchEmailToProfile(supabase, graphUser.email);
          profileCache.set(graphUser.email, pid);
        }
        
        return {
          profileId: profileCache.get(graphUser.email) || null,
          email: graphUser.email,
          displayName: graphUser.displayName,
        };
      }

      // PULL: Import new planner tasks
      if (mapping.sync_direction === 'from_planner' || mapping.sync_direction === 'both') {
        for (const pt of plannerTasks) {
          if (linkedPlannerIds.has(pt.id)) continue;

          // Filter by state
          const taskState = getPlannerState(pt.percentComplete || 0);
          if (!importStates.includes(taskState)) continue;

          try {
            const status = mapping.default_status || plannerPercentToStatus(pt.percentComplete || 0);
            const priority = mapping.default_priority || plannerPriorityToApp(pt.priority || 5);

            // Resolve subcategory from bucket mapping
            const subcategoryId = pt.bucketId ? bucketToSubcategory.get(pt.bucketId) : null;

            // Resolve Planner labels
            const plannerLabels = resolveLabels(pt.appliedCategories || null, categoryDescriptions);

            // Resolve assignee from Planner
            const assigneeInfo = await resolveAssigneeToProfile(pt);
            const assigneeId = assigneeInfo.profileId || userProfile?.id;

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
                date_demande: pt.createdDateTime ? pt.createdDateTime : new Date().toISOString(),
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

            await supabase.from('planner_task_links').insert({
              plan_mapping_id: planMappingId,
              planner_task_id: pt.id,
              local_task_id: newTask.id,
              planner_etag: pt['@odata.etag'],
              sync_status: 'synced',
              planner_assignee_email: assigneeInfo.email || null,
              planner_assignee_name: assigneeInfo.displayName || null,
            });

            tasksPulled++;
          } catch (err: any) {
            errors.push({ plannerTaskId: pt.id, error: err.message });
          }
        }
      }

      // UPDATE: Sync existing linked tasks
      for (const link of (existingLinks || [])) {
        const plannerTask = plannerTasks.find(t => t.id === link.planner_task_id);
        if (!plannerTask) continue;

        try {
          // Get local task from prefetched map
          const localTask = localTasksById.get(link.local_task_id);
          if (!localTask) continue;

          // Pull updates from Planner
          if (mapping.sync_direction === 'from_planner' || mapping.sync_direction === 'both') {
            const plannerStatus = plannerPercentToStatus(plannerTask.percentComplete || 0);
            const plannerPriority = plannerPriorityToApp(plannerTask.priority || 5);

            const updates: any = {};
            if (plannerStatus !== localTask.status) updates.status = plannerStatus;
            if (plannerPriority !== localTask.priority) updates.priority = plannerPriority;
            if (plannerTask.dueDateTime) {
              const dueDate = plannerTask.dueDateTime.substring(0, 10);
              if (dueDate !== localTask.due_date) updates.due_date = dueDate;
            }

            // Sync date_demande from Planner createdDateTime
            if (plannerTask.createdDateTime && !localTask.date_demande) {
              updates.date_demande = plannerTask.createdDateTime;
            }

            // Sync date_lancement from Planner startDateTime
            if (plannerTask.startDateTime && !localTask.date_lancement) {
              updates.date_lancement = plannerTask.startDateTime;
            }

            // Sync date_fermeture from Planner completedDateTime
            if (plannerTask.completedDateTime && !localTask.date_fermeture) {
              updates.date_fermeture = plannerTask.completedDateTime;
            }

            // Fallback: if Planner task is completed but completedDateTime is missing,
            // use imported creation date to avoid false closure spikes on sync date
            if (!plannerTask.completedDateTime && !localTask.date_fermeture && plannerStatus === 'done' && plannerTask.createdDateTime) {
              updates.date_fermeture = plannerTask.createdDateTime;
            }

            // Update planner labels
            const newLabels = resolveLabels(plannerTask.appliedCategories || null, categoryDescriptions);
            const currentLabels = localTask.planner_labels || [];
            if (JSON.stringify(newLabels.sort()) !== JSON.stringify([...currentLabels].sort())) {
              updates.planner_labels = newLabels.length > 0 ? newLabels : null;
            }

            // Update description from Planner notes
            if (plannerTask._description && plannerTask._description !== (localTask.description || '')) {
              updates.description = plannerTask._description;
            }

            if (Object.keys(updates).length > 0) {
              await supabase.from('tasks').update(updates).eq('id', link.local_task_id);
              localTasksById.set(link.local_task_id, { ...localTask, ...updates });
              tasksUpdated++;
            }

            // Sync planner labels to task_labels junction table
            if (newLabels.length > 0 && mapping.mapped_process_template_id) {
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
            const localPercent = statusToPlannerPercent(localTask.status);
            const localPlannerPriority = appPriorityToPlanner(localTask.priority || 'medium');

            const plannerUpdates: any = {};
            if (localPercent !== (plannerTask.percentComplete || 0)) plannerUpdates.percentComplete = localPercent;
            if (localPlannerPriority !== (plannerTask.priority || 5)) plannerUpdates.priority = localPlannerPriority;
            if (localTask.due_date && localTask.due_date !== (plannerTask.dueDateTime || '').substring(0, 10)) {
              plannerUpdates.dueDateTime = localTask.due_date + 'T00:00:00Z';
            }

            if (Object.keys(plannerUpdates).length > 0) {
              try {
                await updatePlannerTask(accessToken, plannerTask.id, plannerTask['@odata.etag'], plannerUpdates);
                tasksUpdated++;
              } catch (err: any) {
                errors.push({ plannerTaskId: plannerTask.id, error: err.message });
              }
            }
          }

          // Update link
          await supabase.from('planner_task_links').update({
            planner_etag: plannerTask['@odata.etag'],
            last_synced_at: new Date().toISOString(),
            sync_status: 'synced',
          }).eq('id', link.id);

        } catch (err: any) {
          errors.push({ plannerTaskId: link.planner_task_id, error: err.message });
        }
      }

      // PUSH: Push local unlinked tasks to Planner
      if (mapping.sync_direction === 'to_planner' || mapping.sync_direction === 'both') {
        // Get local tasks for this category that are not yet linked
        let localQuery = supabase.from('tasks').select('*').eq('user_id', userId).eq('type', 'task');
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

            await supabase.from('planner_task_links').insert({
              plan_mapping_id: planMappingId,
              planner_task_id: created.id,
              local_task_id: lt.id,
              planner_etag: created['@odata.etag'],
              sync_status: 'synced',
            });

            tasksPushed++;
          } catch (err: any) {
            errors.push({ localTaskId: lt.id, error: err.message });
          }
        }
      }

      // Update mapping
      await supabase.from('planner_plan_mappings').update({ last_sync_at: new Date().toISOString() }).eq('id', planMappingId);

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
      };

      try {
        if (syncLogId) {
          const { error: updateErr } = await supabase.from('planner_sync_logs').update(finalLogData).eq('id', syncLogId);
          if (updateErr) {
            console.error('Failed to update sync log, inserting new:', updateErr);
            await supabase.from('planner_sync_logs').insert(finalLogData);
          }
        } else {
          const { error: insertErr } = await supabase.from('planner_sync_logs').insert(finalLogData);
          if (insertErr) console.error('Failed to insert final sync log:', insertErr);
        }
      } catch (logFinalErr) {
        console.error('Sync log finalization error:', logFinalErr);
        // Last resort: try one more time
        try {
          await supabase.from('planner_sync_logs').insert(finalLogData);
        } catch (_) { /* give up */ }
      }

      return new Response(JSON.stringify({
        success: true,
        tasksPulled,
        tasksPushed,
        tasksUpdated,
        errors: errors.length,
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
