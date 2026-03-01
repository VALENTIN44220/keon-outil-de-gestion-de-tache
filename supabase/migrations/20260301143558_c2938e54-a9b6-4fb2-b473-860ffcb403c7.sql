
-- Drop and recreate the CHECK constraint to include 'external'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check CHECK (status IN ('active', 'suspended', 'deleted', 'external'));

-- Update comment
COMMENT ON COLUMN public.profiles.status IS 'User status: active (default), suspended (temp removed), deleted (left company), external (hors organisation)';
