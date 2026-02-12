
-- Add can_access_process_tracking to permission_profiles
ALTER TABLE public.permission_profiles 
ADD COLUMN IF NOT EXISTS can_access_process_tracking boolean NOT NULL DEFAULT true;

-- Add can_access_process_tracking to user_permission_overrides
ALTER TABLE public.user_permission_overrides
ADD COLUMN IF NOT EXISTS can_access_process_tracking boolean DEFAULT NULL;
