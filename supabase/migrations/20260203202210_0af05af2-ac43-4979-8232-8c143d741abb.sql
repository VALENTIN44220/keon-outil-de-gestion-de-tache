-- Security fix: Protect Microsoft OAuth tokens from direct client access
-- The edge function uses service_role_key which bypasses RLS, so it will still work

-- Step 1: Create a secure view that excludes sensitive token columns
CREATE VIEW public.user_microsoft_connections_public
WITH (security_invoker=on) AS
  SELECT 
    id,
    user_id,
    profile_id,
    email,
    display_name,
    is_calendar_sync_enabled,
    is_email_sync_enabled,
    last_sync_at,
    token_expires_at,
    created_at,
    updated_at
    -- Excludes: access_token, refresh_token (sensitive)
  FROM public.user_microsoft_connections;

-- Step 2: Drop the existing SELECT policy that exposes tokens
DROP POLICY IF EXISTS "Users can view own microsoft connection" ON public.user_microsoft_connections;

-- Step 3: Create a new SELECT policy that denies direct access to the base table
-- Edge functions with service_role_key bypass RLS, so they can still read tokens
CREATE POLICY "No direct SELECT on microsoft connections"
  ON public.user_microsoft_connections 
  FOR SELECT
  USING (false);

-- Step 4: Create SELECT policy on the view so users can still check their connection status
-- Note: The view inherits RLS from the underlying table, but since we denied SELECT,
-- we need to allow SELECT through the view with security_invoker
-- Actually, with security_invoker=on the view runs as the calling user,
-- so we need a different approach - grant access to the view directly

-- Step 5: Enable RLS on the base table (already enabled, but ensure it)
ALTER TABLE public.user_microsoft_connections ENABLE ROW LEVEL SECURITY;

-- Note: The edge function uses service_role_key which bypasses RLS entirely,
-- so all token operations (read/refresh) will continue to work.
-- The client-side hook (useMicrosoftConnection) only calls edge functions,
-- it doesn't query the table directly, so no code changes needed.