-- Add can_access_calendar column to permission_profiles
ALTER TABLE public.permission_profiles 
ADD COLUMN IF NOT EXISTS can_access_calendar BOOLEAN NOT NULL DEFAULT true;

-- Add can_access_calendar column to user_permission_overrides
ALTER TABLE public.user_permission_overrides 
ADD COLUMN IF NOT EXISTS can_access_calendar BOOLEAN DEFAULT NULL;