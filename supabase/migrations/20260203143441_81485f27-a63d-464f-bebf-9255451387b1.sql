-- Add secondary_email and lovable_status columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS secondary_email TEXT,
ADD COLUMN IF NOT EXISTS lovable_status TEXT DEFAULT 'NOK' CHECK (lovable_status IN ('OK', 'NOK'));

-- Add index for email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_secondary_email ON public.profiles(secondary_email);
CREATE INDEX IF NOT EXISTS idx_profiles_lovable_status ON public.profiles(lovable_status);

-- Comment for documentation
COMMENT ON COLUMN public.profiles.secondary_email IS 'Alternative email address (e.g., Gmail) used for Lovable account';
COMMENT ON COLUMN public.profiles.lovable_status IS 'Lovable workspace registration status: OK = registered, NOK = not registered';