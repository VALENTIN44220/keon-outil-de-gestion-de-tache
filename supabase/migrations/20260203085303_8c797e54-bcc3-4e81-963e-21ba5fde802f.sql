-- Add lovable_email column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lovable_email TEXT;

-- Copy existing emails from auth.users to profiles.lovable_email
-- Using a function to update existing profiles with their auth email
DO $$
DECLARE
  profile_record RECORD;
  auth_email TEXT;
BEGIN
  FOR profile_record IN SELECT id, user_id FROM public.profiles WHERE lovable_email IS NULL LOOP
    SELECT email INTO auth_email FROM auth.users WHERE id = profile_record.user_id;
    IF auth_email IS NOT NULL THEN
      UPDATE public.profiles SET lovable_email = auth_email WHERE id = profile_record.id;
    END IF;
  END LOOP;
END $$;

-- Add an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_lovable_email ON public.profiles(lovable_email);