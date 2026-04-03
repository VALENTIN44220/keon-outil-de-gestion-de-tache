-- Function called by the link-microsoft-account edge function (service_role only).
-- It atomically moves an azure identity from a newly-created Microsoft-only user
-- to an existing email+password user, then patches the target profile.
CREATE OR REPLACE FUNCTION public.transfer_azure_identity(
  p_from_user_id  UUID,   -- new user created by Microsoft OAuth (no profile)
  p_to_user_id    UUID,   -- existing authorised user (has profile)
  p_microsoft_email TEXT  -- email returned by Microsoft, stored as secondary_email
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Move the azure identity to the target user
  UPDATE auth.identities
  SET user_id = p_to_user_id
  WHERE user_id = p_from_user_id
    AND provider = 'azure';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'azure_identity_not_found';
  END IF;

  -- Store Microsoft email in secondary_email when it differs from lovable_email
  UPDATE public.profiles
  SET secondary_email = p_microsoft_email
  WHERE user_id = p_to_user_id
    AND lower(p_microsoft_email) <> lower(coalesce(lovable_email, ''))
    AND (secondary_email IS NULL OR secondary_email = '');
END;
$$;

-- Only the service role (edge function) may call this
REVOKE EXECUTE ON FUNCTION public.transfer_azure_identity(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.transfer_azure_identity(UUID, UUID, TEXT)
  TO service_role;
