-- Add screen access permissions to permission_profiles
ALTER TABLE public.permission_profiles
ADD COLUMN IF NOT EXISTS can_access_dashboard boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS can_access_tasks boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS can_access_requests boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS can_access_templates boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS can_access_workload boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS can_access_analytics boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS can_access_team boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS can_access_settings boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS can_access_projects boolean NOT NULL DEFAULT true;

-- Create table for process template visibility per profile
CREATE TABLE IF NOT EXISTS public.permission_profile_process_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_profile_id uuid NOT NULL REFERENCES public.permission_profiles(id) ON DELETE CASCADE,
  process_template_id uuid NOT NULL REFERENCES public.process_templates(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(permission_profile_id, process_template_id)
);

-- Enable RLS
ALTER TABLE public.permission_profile_process_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for permission_profile_process_templates
CREATE POLICY "Authenticated users can read permission_profile_process_templates"
ON public.permission_profile_process_templates
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage permission_profile_process_templates"
ON public.permission_profile_process_templates
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create table for user-specific permission overrides
CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  -- Screen access overrides (null = use profile default, true = grant, false = deny)
  can_access_dashboard boolean DEFAULT NULL,
  can_access_tasks boolean DEFAULT NULL,
  can_access_requests boolean DEFAULT NULL,
  can_access_templates boolean DEFAULT NULL,
  can_access_workload boolean DEFAULT NULL,
  can_access_analytics boolean DEFAULT NULL,
  can_access_team boolean DEFAULT NULL,
  can_access_settings boolean DEFAULT NULL,
  can_access_projects boolean DEFAULT NULL,
  -- Task permissions overrides
  can_manage_users boolean DEFAULT NULL,
  can_manage_templates boolean DEFAULT NULL,
  can_view_own_tasks boolean DEFAULT NULL,
  can_manage_own_tasks boolean DEFAULT NULL,
  can_view_subordinates_tasks boolean DEFAULT NULL,
  can_manage_subordinates_tasks boolean DEFAULT NULL,
  can_assign_to_subordinates boolean DEFAULT NULL,
  can_view_all_tasks boolean DEFAULT NULL,
  can_manage_all_tasks boolean DEFAULT NULL,
  can_assign_to_all boolean DEFAULT NULL,
  -- BE Projects overrides
  can_view_be_projects boolean DEFAULT NULL,
  can_create_be_projects boolean DEFAULT NULL,
  can_edit_be_projects boolean DEFAULT NULL,
  can_delete_be_projects boolean DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_permission_overrides
CREATE POLICY "Users can read their own permission overrides"
ON public.user_permission_overrides
FOR SELECT
TO authenticated
USING (user_id = public.current_profile_id() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage permission overrides"
ON public.user_permission_overrides
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create table for user-specific process template overrides
CREATE TABLE IF NOT EXISTS public.user_process_template_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  process_template_id uuid NOT NULL REFERENCES public.process_templates(id) ON DELETE CASCADE,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, process_template_id)
);

-- Enable RLS
ALTER TABLE public.user_process_template_overrides ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can read their own process template overrides"
ON public.user_process_template_overrides
FOR SELECT
TO authenticated
USING (user_id = public.current_profile_id() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage process template overrides"
ON public.user_process_template_overrides
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update trigger for user_permission_overrides
CREATE TRIGGER update_user_permission_overrides_updated_at
BEFORE UPDATE ON public.user_permission_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();