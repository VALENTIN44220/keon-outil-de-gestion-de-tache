
-- Add new visibility modes to the enum
ALTER TYPE template_visibility ADD VALUE IF NOT EXISTS 'internal_group';
ALTER TYPE template_visibility ADD VALUE IF NOT EXISTS 'internal_users';

-- Junction tables for GROUP visibility (process, sub_process, task)
CREATE TABLE IF NOT EXISTS public.process_template_visible_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_template_id UUID NOT NULL REFERENCES public.process_templates(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.collaborator_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(process_template_id, group_id)
);
ALTER TABLE public.process_template_visible_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read" ON public.process_template_visible_groups FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage" ON public.process_template_visible_groups FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.sub_process_template_visible_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sub_process_template_id UUID NOT NULL REFERENCES public.sub_process_templates(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.collaborator_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sub_process_template_id, group_id)
);
ALTER TABLE public.sub_process_template_visible_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read" ON public.sub_process_template_visible_groups FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage" ON public.sub_process_template_visible_groups FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.task_template_visible_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_template_id UUID NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.collaborator_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_template_id, group_id)
);
ALTER TABLE public.task_template_visible_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read" ON public.task_template_visible_groups FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage" ON public.task_template_visible_groups FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Junction tables for USER LIST visibility (process, sub_process, task)
CREATE TABLE IF NOT EXISTS public.process_template_visible_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_template_id UUID NOT NULL REFERENCES public.process_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(process_template_id, user_id)
);
ALTER TABLE public.process_template_visible_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read" ON public.process_template_visible_users FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage" ON public.process_template_visible_users FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.sub_process_template_visible_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sub_process_template_id UUID NOT NULL REFERENCES public.sub_process_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sub_process_template_id, user_id)
);
ALTER TABLE public.sub_process_template_visible_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read" ON public.sub_process_template_visible_users FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage" ON public.sub_process_template_visible_users FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.task_template_visible_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_template_id UUID NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_template_id, user_id)
);
ALTER TABLE public.task_template_visible_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read" ON public.task_template_visible_users FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage" ON public.task_template_visible_users FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Update the can_view_template function to support new visibility modes
CREATE OR REPLACE FUNCTION public.can_view_template(
  _visibility template_visibility,
  _creator_id uuid,
  _creator_company_id uuid,
  _creator_department_id uuid,
  _template_type text DEFAULT 'process'::text,
  _template_id uuid DEFAULT NULL::uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _current_user_id uuid;
  _current_profile_id uuid;
  _current_company_id uuid;
  _current_department_id uuid;
  _is_admin boolean;
BEGIN
  _current_user_id := auth.uid();
  
  IF _current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _current_user_id AND role = 'admin'
  ) INTO _is_admin;
  
  IF _is_admin THEN RETURN true; END IF;
  
  IF _creator_id = _current_user_id THEN RETURN true; END IF;
  
  SELECT id, company_id, department_id 
  INTO _current_profile_id, _current_company_id, _current_department_id
  FROM public.profiles 
  WHERE user_id = _current_user_id;
  
  CASE _visibility
    WHEN 'private' THEN
      RETURN false;
      
    WHEN 'internal_department' THEN
      IF _template_id IS NOT NULL THEN
        IF _template_type = 'process' THEN
          RETURN EXISTS (SELECT 1 FROM public.process_template_visible_departments WHERE process_template_id = _template_id AND department_id = _current_department_id);
        ELSIF _template_type = 'sub_process' THEN
          RETURN EXISTS (SELECT 1 FROM public.sub_process_template_visible_departments WHERE sub_process_template_id = _template_id AND department_id = _current_department_id);
        ELSIF _template_type = 'task' THEN
          RETURN EXISTS (SELECT 1 FROM public.task_template_visible_departments WHERE task_template_id = _template_id AND department_id = _current_department_id);
        END IF;
      END IF;
      RETURN _current_department_id IS NOT NULL AND _current_department_id = _creator_department_id;
      
    WHEN 'internal_company' THEN
      IF _template_id IS NOT NULL THEN
        IF _template_type = 'process' THEN
          RETURN EXISTS (SELECT 1 FROM public.process_template_visible_companies WHERE process_template_id = _template_id AND company_id = _current_company_id);
        ELSIF _template_type = 'sub_process' THEN
          RETURN EXISTS (SELECT 1 FROM public.sub_process_template_visible_companies WHERE sub_process_template_id = _template_id AND company_id = _current_company_id);
        ELSIF _template_type = 'task' THEN
          RETURN EXISTS (SELECT 1 FROM public.task_template_visible_companies WHERE task_template_id = _template_id AND company_id = _current_company_id);
        END IF;
      END IF;
      RETURN _current_company_id IS NOT NULL AND _current_company_id = _creator_company_id;
      
    WHEN 'internal_group' THEN
      IF _template_id IS NOT NULL AND _current_profile_id IS NOT NULL THEN
        IF _template_type = 'process' THEN
          RETURN EXISTS (
            SELECT 1 FROM public.process_template_visible_groups vg
            JOIN public.collaborator_group_members cgm ON cgm.group_id = vg.group_id
            WHERE vg.process_template_id = _template_id AND cgm.user_id = _current_profile_id
          );
        ELSIF _template_type = 'sub_process' THEN
          RETURN EXISTS (
            SELECT 1 FROM public.sub_process_template_visible_groups vg
            JOIN public.collaborator_group_members cgm ON cgm.group_id = vg.group_id
            WHERE vg.sub_process_template_id = _template_id AND cgm.user_id = _current_profile_id
          );
        ELSIF _template_type = 'task' THEN
          RETURN EXISTS (
            SELECT 1 FROM public.task_template_visible_groups vg
            JOIN public.collaborator_group_members cgm ON cgm.group_id = vg.group_id
            WHERE vg.task_template_id = _template_id AND cgm.user_id = _current_profile_id
          );
        END IF;
      END IF;
      RETURN false;
      
    WHEN 'internal_users' THEN
      IF _template_id IS NOT NULL AND _current_profile_id IS NOT NULL THEN
        IF _template_type = 'process' THEN
          RETURN EXISTS (SELECT 1 FROM public.process_template_visible_users WHERE process_template_id = _template_id AND user_id = _current_profile_id);
        ELSIF _template_type = 'sub_process' THEN
          RETURN EXISTS (SELECT 1 FROM public.sub_process_template_visible_users WHERE sub_process_template_id = _template_id AND user_id = _current_profile_id);
        ELSIF _template_type = 'task' THEN
          RETURN EXISTS (SELECT 1 FROM public.task_template_visible_users WHERE task_template_id = _template_id AND user_id = _current_profile_id);
        END IF;
      END IF;
      RETURN false;
      
    WHEN 'public' THEN
      RETURN true;
    ELSE
      RETURN false;
  END CASE;
END;
$function$;
