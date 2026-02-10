
-- Add can_access_suppliers to permission_profiles
ALTER TABLE public.permission_profiles
ADD COLUMN IF NOT EXISTS can_access_suppliers boolean NOT NULL DEFAULT false;

-- Add can_access_suppliers to user_permission_overrides
ALTER TABLE public.user_permission_overrides
ADD COLUMN IF NOT EXISTS can_access_suppliers boolean DEFAULT NULL;
