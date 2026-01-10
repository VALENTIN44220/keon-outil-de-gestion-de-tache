-- Add proper foreign key columns to profiles and a flag for password change
ALTER TABLE public.profiles 
  ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN job_title_id uuid REFERENCES public.job_titles(id) ON DELETE SET NULL,
  ADD COLUMN hierarchy_level_id uuid REFERENCES public.hierarchy_levels(id) ON DELETE SET NULL,
  ADD COLUMN permission_profile_id uuid REFERENCES public.permission_profiles(id) ON DELETE SET NULL,
  ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;

-- Add indexes for better performance
CREATE INDEX idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX idx_profiles_department_id ON public.profiles(department_id);
CREATE INDEX idx_profiles_manager_id ON public.profiles(manager_id);

-- Update RLS policy for admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Allow admins to update any profile
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Comments
COMMENT ON COLUMN public.profiles.must_change_password IS 'Force password change on next login';
COMMENT ON COLUMN public.profiles.hierarchy_level_id IS 'Niveau hiérarchique de l''utilisateur';
COMMENT ON COLUMN public.profiles.permission_profile_id IS 'Profil de droits assigné';