import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── 1. Identify the calling user (the new Microsoft-only account) ────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'unauthenticated' }, 401);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: currentUser }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !currentUser) return json({ error: 'invalid_token' }, 401);

    // ── 2. Validate: current user must have an azure identity ────────────────
    const { data: identities } = await admin
      .schema('auth')
      .from('identities')
      .select('provider')
      .eq('user_id', currentUser.id)
      .eq('provider', 'azure')
      .limit(1);

    // Fallback: check user metadata if direct query unavailable
    const hasAzure =
      (identities && identities.length > 0) ||
      currentUser.app_metadata?.provider === 'azure' ||
      (currentUser.app_metadata?.providers as string[] | undefined)?.includes('azure');

    if (!hasAzure) return json({ error: 'not_an_azure_user' }, 400);

    // ── 3. Current user must NOT already have a profile ───────────────────────
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (existingProfile) return json({ error: 'already_has_profile' }, 400);

    // ── 4. Resolve target user by the email provided ─────────────────────────
    const { targetEmail } = (await req.json()) as { targetEmail: string };
    if (!targetEmail?.trim()) return json({ error: 'target_email_required' }, 400);

    const normalised = targetEmail.trim().toLowerCase();

    // Try auth.users first (exact email match)
    const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const targetAuthUser = authUsers?.users.find(
      (u) => u.email?.toLowerCase() === normalised,
    );

    // Also try profiles.lovable_email / secondary_email
    let targetUserId: string | null = targetAuthUser?.id ?? null;

    if (!targetUserId) {
      const { data: profileRow } = await admin
        .from('profiles')
        .select('user_id')
        .or(`lovable_email.ilike.${normalised},secondary_email.ilike.${normalised}`)
        .maybeSingle();
      targetUserId = profileRow?.user_id ?? null;
    }

    if (!targetUserId) return json({ error: 'target_not_found' }, 404);
    if (targetUserId === currentUser.id) return json({ error: 'same_user' }, 400);

    // ── 5. Target must have a profile (authorised in the app) ────────────────
    const { data: targetProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (!targetProfile) return json({ error: 'target_not_authorised' }, 403);

    // ── 6. Transfer identity (RPC removes any existing Azure row on target first)

    // ── 7. Atomically replace target Azure if present, move temp identity, patch profile ─
    const microsoftEmail = currentUser.email ?? '';

    const { error: transferErr } = await admin.rpc('transfer_azure_identity', {
      p_from_user_id:    currentUser.id,
      p_to_user_id:      targetUserId,
      p_microsoft_email: microsoftEmail,
    });

    if (transferErr) {
      console.error('transfer_azure_identity error:', transferErr);
      return json({ error: 'transfer_failed', detail: transferErr.message }, 500);
    }

    // ── 8. Delete the now-identity-less temporary user ────────────────────────
    const { error: deleteErr } = await admin.auth.admin.deleteUser(currentUser.id);
    if (deleteErr) {
      // Non-fatal: identity is already moved, profile is patched.
      console.warn('Could not delete temp user:', deleteErr.message);
    }

    return json({ success: true });
  } catch (err: any) {
    console.error('link-microsoft-account error:', err);
    return json({ error: 'internal_error', detail: err?.message }, 500);
  }
});
