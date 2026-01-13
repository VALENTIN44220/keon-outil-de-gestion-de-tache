-- Add BE Projects permissions to permission_profiles table
ALTER TABLE public.permission_profiles
ADD COLUMN can_view_be_projects boolean DEFAULT true,
ADD COLUMN can_create_be_projects boolean DEFAULT false,
ADD COLUMN can_edit_be_projects boolean DEFAULT false,
ADD COLUMN can_delete_be_projects boolean DEFAULT false;

-- Update existing profiles with default permissions
-- Administrateur: full access
UPDATE public.permission_profiles
SET can_view_be_projects = true,
    can_create_be_projects = true,
    can_edit_be_projects = true,
    can_delete_be_projects = true
WHERE name = 'Administrateur';

-- Manager: view and edit
UPDATE public.permission_profiles
SET can_view_be_projects = true,
    can_create_be_projects = true,
    can_edit_be_projects = true,
    can_delete_be_projects = false
WHERE name = 'Manager';

-- Standard users: view only
UPDATE public.permission_profiles
SET can_view_be_projects = true,
    can_create_be_projects = false,
    can_edit_be_projects = false,
    can_delete_be_projects = false
WHERE name = 'Utilisateur standard';