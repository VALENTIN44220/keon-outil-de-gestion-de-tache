-- Follow-up: target may already have an Azure identity. Remove it on the target user,
-- then move the temporary user's Azure row onto the target (same transfer_azure_identity RPC).
-- Does not alter public.profiles PK / user_id; app data stays on the target account.

CREATE OR REPLACE FUNCTION public.transfer_azure_identity(
  p_from_user_id  UUID,
  p_to_user_id    UUID,
  p_microsoft_email TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  DELETE FROM auth.identities
  WHERE user_id = p_to_user_id
    AND provider = 'azure';

  UPDATE auth.identities
  SET user_id = p_to_user_id
  WHERE user_id = p_from_user_id
    AND provider = 'azure';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'azure_identity_not_found';
  END IF;

  UPDATE public.profiles
  SET secondary_email = p_microsoft_email
  WHERE user_id = p_to_user_id
    AND lower(p_microsoft_email) <> lower(coalesce(lovable_email, ''))
    AND (secondary_email IS NULL OR secondary_email = '');
END;
$$;
