import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MICROSOFT_GRAPH_URL = 'https://graph.microsoft.com/v1.0';

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
    throw new Error('Azure AD credentials not configured (AZURE_CLIENT_ID, AZURE_TENANT_ID, and AZURE_CLIENT_SECRET required)');
  }

  return { clientId, clientSecret, tenantId };
}

// Exchange authorization code for tokens (server-side confidential client flow)
async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  const { clientId, clientSecret, tenantId } = getAzureCredentials();
  
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const bodyParams: Record<string, string> = {
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    scope: 'openid profile email offline_access User.Read Calendars.Read Calendars.ReadWrite Mail.Send',
  };

  const body = new URLSearchParams(bodyParams);

  console.log('Token exchange request to:', tokenUrl);

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
    scope: 'openid profile email offline_access User.Read Calendars.Read Calendars.ReadWrite Mail.Send',
  };

  // Add client secret if available
  if (clientSecret) {
    bodyParams.client_secret = clientSecret;
  }

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
async function getValidAccessToken(
  supabase: any,
  userId: string
): Promise<string | null> {
  const { data: connection, error } = await supabase
    .from('user_microsoft_connections')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !connection) {
    console.log('No Microsoft connection found for user');
    return null;
  }

  const now = new Date();
  const expiresAt = new Date(connection.token_expires_at);

  // If token expires in less than 5 minutes, refresh it
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    if (!connection.refresh_token) {
      console.log('No refresh token available');
      return null;
    }

    try {
      const tokens = await refreshAccessToken(connection.refresh_token);
      
      // Update stored tokens
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
async function fetchCalendarEvents(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
  const allEvents: any[] = [];
  let url: string | null = `${MICROSOFT_GRAPH_URL}/me/calendarView?startDateTime=${startDate}&endDateTime=${endDate}&$orderby=start/dateTime&$top=500`;

  while (url) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'odata.maxpagesize=500',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Calendar fetch error:', errorText);
      throw new Error(`Failed to fetch calendar: ${response.status}`);
    }

    const data = await response.json();
    const events = data.value || [];
    allEvents.push(...events);

    // Follow @odata.nextLink for pagination
    url = data['@odata.nextLink'] || null;
  }

  console.log(`Fetched ${allEvents.length} calendar events total`);
  return allEvents;
}

// Send email via Microsoft Graph
async function sendEmail(
  accessToken: string,
  to: string[],
  subject: string,
  body: string,
  isHtml: boolean = true
): Promise<void> {
  const url = `${MICROSOFT_GRAPH_URL}/me/sendMail`;

  const message = {
    message: {
      subject,
      body: {
        contentType: isHtml ? 'HTML' : 'Text',
        content: body,
      },
      toRecipients: to.map(email => ({
        emailAddress: { address: email },
      })),
    },
    saveToSentItems: true,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Email send error:', errorText);
    throw new Error(`Failed to send email: ${response.status}`);
  }
}

// Get user profile from Microsoft Graph
async function getUserProfile(accessToken: string): Promise<any> {
  const response = await fetch(`${MICROSOFT_GRAPH_URL}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get user profile: ${response.status}`);
  }

  return await response.json();
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

    // Action: Get OAuth URL (server-side flow, no PKCE)
    if (action === 'get-auth-url') {
      const { clientId, tenantId } = getAzureCredentials();
      const { redirectUri } = params;
      
      const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
        `client_id=${clientId}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_mode=query` +
        `&scope=${encodeURIComponent('openid profile email offline_access User.Read Calendars.Read Calendars.ReadWrite Mail.Send')}` +
        `&state=microsoft-${userId || 'anonymous'}`;

      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: Exchange code for tokens (server-side flow)
    if (action === 'exchange-code') {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { code, redirectUri } = params;
      const tokens = await exchangeCodeForTokens(code, redirectUri);
      
      // Get user profile from Microsoft
      const profile = await getUserProfile(tokens.access_token);

      // Get profile_id
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      // Upsert connection
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
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: Sync calendar
    if (action === 'sync-calendar') {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { startDate, endDate } = params;
      const accessToken = await getValidAccessToken(supabase, userId);
      
      if (!accessToken) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'No valid Microsoft connection' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const events = await fetchCalendarEvents(accessToken, startDate, endDate);

      // Upsert events to database
      for (const event of events) {
        await supabase
          .from('outlook_calendar_events')
          .upsert({
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

      // Update last sync time
      await supabase
        .from('user_microsoft_connections')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('user_id', userId);

      return new Response(JSON.stringify({ 
        success: true, 
        syncedEvents: events.length 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: Get calendar events (from cache)
    if (action === 'get-calendar-events') {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { startDate, endDate, includeSubordinates } = params;

      let query = supabase
        .from('outlook_calendar_events')
        .select('*')
        .gte('start_time', startDate)
        .lte('end_time', endDate)
        .order('start_time');

      if (!includeSubordinates) {
        query = query.eq('user_id', userId);
      }

      const { data: events, error } = await query;

      if (error) throw error;

      return new Response(JSON.stringify({ events }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: Send email
    if (action === 'send-email') {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { to, subject, body, isHtml } = params;
      const accessToken = await getValidAccessToken(supabase, userId);
      
      if (!accessToken) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'No valid Microsoft connection' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await sendEmail(accessToken, to, subject, body, isHtml);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: Check connection status
    if (action === 'check-connection') {
      if (!userId) {
        return new Response(JSON.stringify({ connected: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: connection } = await supabase
        .from('user_microsoft_connections')
        .select('email, display_name, is_calendar_sync_enabled, is_email_sync_enabled, last_sync_at')
        .eq('user_id', userId)
        .single();

      return new Response(JSON.stringify({ 
        connected: !!connection,
        ...connection 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: Disconnect
    if (action === 'disconnect') {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      await supabase
        .from('user_microsoft_connections')
        .delete()
        .eq('user_id', userId);

      await supabase
        .from('outlook_calendar_events')
        .delete()
        .eq('user_id', userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: any) {
    console.error('Microsoft Graph error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
