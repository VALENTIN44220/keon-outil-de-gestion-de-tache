-- Add user status to profiles table
-- Status: 'active' (default), 'suspended' (temporarily removed from assignments), 'deleted' (left company, keep history)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Add constraint to ensure valid status values
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_status_check CHECK (status IN ('active', 'suspended', 'deleted'));

-- Create index for filtering by status
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- Comment for documentation
COMMENT ON COLUMN public.profiles.status IS 'User status: active (default), suspended (temp removed from assignments), deleted (left company, keeps history)';