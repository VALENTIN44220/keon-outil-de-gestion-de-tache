-- Create an enum for visibility levels
CREATE TYPE public.template_visibility AS ENUM ('private', 'internal_department', 'internal_company', 'public');

-- Add visibility_level to process_templates
ALTER TABLE public.process_templates
ADD COLUMN visibility_level template_visibility NOT NULL DEFAULT 'public';

-- Add visibility_level to sub_process_templates
ALTER TABLE public.sub_process_templates
ADD COLUMN visibility_level template_visibility NOT NULL DEFAULT 'public';

-- Add visibility_level to task_templates
ALTER TABLE public.task_templates
ADD COLUMN visibility_level template_visibility NOT NULL DEFAULT 'public';

-- Add creator's company_id and department_id to templates for visibility filtering
ALTER TABLE public.process_templates
ADD COLUMN creator_company_id uuid REFERENCES public.companies(id),
ADD COLUMN creator_department_id uuid REFERENCES public.departments(id);

ALTER TABLE public.sub_process_templates
ADD COLUMN creator_company_id uuid REFERENCES public.companies(id),
ADD COLUMN creator_department_id uuid REFERENCES public.departments(id);

ALTER TABLE public.task_templates
ADD COLUMN creator_company_id uuid REFERENCES public.companies(id),
ADD COLUMN creator_department_id uuid REFERENCES public.departments(id);

-- Create a function to check if user can view a template based on visibility
CREATE OR REPLACE FUNCTION public.can_view_template(
  _visibility template_visibility,
  _creator_id uuid,
  _creator_company_id uuid,
  _creator_department_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_user_id uuid;
  _current_company_id uuid;
  _current_department_id uuid;
  _is_admin boolean;
BEGIN
  _current_user_id := auth.uid();
  
  -- Check if admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _current_user_id AND role = 'admin'
  ) INTO _is_admin;
  
  IF _is_admin THEN
    RETURN true;
  END IF;
  
  -- Creator can always see their own templates
  IF _creator_id = _current_user_id THEN
    RETURN true;
  END IF;
  
  -- Get current user's company and department
  SELECT company_id, department_id 
  INTO _current_company_id, _current_department_id
  FROM public.profiles 
  WHERE user_id = _current_user_id;
  
  -- Check visibility level
  CASE _visibility
    WHEN 'private' THEN
      RETURN false; -- Only creator and admin (already handled above)
    WHEN 'internal_department' THEN
      RETURN _current_department_id IS NOT NULL AND _current_department_id = _creator_department_id;
    WHEN 'internal_company' THEN
      RETURN _current_company_id IS NOT NULL AND _current_company_id = _creator_company_id;
    WHEN 'public' THEN
      RETURN true;
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- Create a function to check if user can manage a template based on hierarchy
CREATE OR REPLACE FUNCTION public.can_manage_template(
  _creator_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_user_id uuid;
  _current_profile_id uuid;
  _is_admin boolean;
  _is_director boolean;
  _is_manager boolean;
  _current_department_id uuid;
  _current_hierarchy_level int;
  _creator_profile_id uuid;
  _creator_department_id uuid;
  _creator_manager_id uuid;
BEGIN
  _current_user_id := auth.uid();
  
  -- Owner can always manage
  IF _creator_id = _current_user_id THEN
    RETURN true;
  END IF;
  
  -- Check if admin (full access)
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _current_user_id AND role = 'admin'
  ) INTO _is_admin;
  
  IF _is_admin THEN
    RETURN true;
  END IF;
  
  -- Get current user profile info
  SELECT id, department_id, COALESCE(
    (SELECT level FROM hierarchy_levels WHERE id = profiles.hierarchy_level_id), 
    999
  )
  INTO _current_profile_id, _current_department_id, _current_hierarchy_level
  FROM public.profiles 
  WHERE user_id = _current_user_id;
  
  -- Get creator profile info
  SELECT id, department_id, manager_id
  INTO _creator_profile_id, _creator_department_id, _creator_manager_id
  FROM public.profiles 
  WHERE user_id = _creator_id;
  
  -- Director level (level <= 2): can manage department members' templates
  IF _current_hierarchy_level <= 2 THEN
    IF _current_department_id IS NOT NULL AND _current_department_id = _creator_department_id THEN
      RETURN true;
    END IF;
  END IF;
  
  -- Manager level: check if creator is a subordinate (recursive check)
  IF _current_hierarchy_level <= 3 THEN
    -- Check if the creator's manager chain includes current user
    WITH RECURSIVE subordinate_chain AS (
      SELECT id, manager_id FROM profiles WHERE manager_id = _current_profile_id
      UNION ALL
      SELECT p.id, p.manager_id FROM profiles p
      INNER JOIN subordinate_chain sc ON p.manager_id = sc.id
    )
    SELECT EXISTS (
      SELECT 1 FROM subordinate_chain WHERE id = _creator_profile_id
    ) INTO _is_manager;
    
    IF _is_manager THEN
      RETURN true;
    END IF;
  END IF;
  
  RETURN false;
END;
$$;

-- Drop existing RLS policies for process_templates
DROP POLICY IF EXISTS "Users can view own or shared process templates" ON public.process_templates;
DROP POLICY IF EXISTS "Users can view their own process templates" ON public.process_templates;
DROP POLICY IF EXISTS "Users can insert their own process templates" ON public.process_templates;
DROP POLICY IF EXISTS "Users can update their own process templates" ON public.process_templates;
DROP POLICY IF EXISTS "Users can delete their own process templates" ON public.process_templates;

-- Create new RLS policies for process_templates
CREATE POLICY "Users can view process templates based on visibility"
ON public.process_templates FOR SELECT
USING (
  can_view_template(visibility_level, user_id, creator_company_id, creator_department_id)
);

CREATE POLICY "Users can insert their own process templates"
ON public.process_templates FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update process templates they can manage"
ON public.process_templates FOR UPDATE
USING (can_manage_template(user_id));

CREATE POLICY "Users can delete process templates they can manage"
ON public.process_templates FOR DELETE
USING (can_manage_template(user_id));

-- Drop existing RLS policies for sub_process_templates
DROP POLICY IF EXISTS "Users can view own or shared sub_process_templates" ON public.sub_process_templates;
DROP POLICY IF EXISTS "Users can insert their own sub_process_templates" ON public.sub_process_templates;
DROP POLICY IF EXISTS "Users can update their own sub_process_templates" ON public.sub_process_templates;
DROP POLICY IF EXISTS "Users can delete their own sub_process_templates" ON public.sub_process_templates;

-- Create new RLS policies for sub_process_templates
CREATE POLICY "Users can view sub_process_templates based on visibility"
ON public.sub_process_templates FOR SELECT
USING (
  can_view_template(visibility_level, user_id, creator_company_id, creator_department_id)
);

CREATE POLICY "Users can insert their own sub_process_templates"
ON public.sub_process_templates FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update sub_process_templates they can manage"
ON public.sub_process_templates FOR UPDATE
USING (can_manage_template(user_id));

CREATE POLICY "Users can delete sub_process_templates they can manage"
ON public.sub_process_templates FOR DELETE
USING (can_manage_template(user_id));

-- Drop existing RLS policies for task_templates
DROP POLICY IF EXISTS "Users can view own or shared task templates" ON public.task_templates;
DROP POLICY IF EXISTS "Users can view their own task templates" ON public.task_templates;
DROP POLICY IF EXISTS "Users can insert their own task templates" ON public.task_templates;
DROP POLICY IF EXISTS "Users can update their own task templates" ON public.task_templates;
DROP POLICY IF EXISTS "Users can delete their own task templates" ON public.task_templates;

-- Create new RLS policies for task_templates
CREATE POLICY "Users can view task_templates based on visibility"
ON public.task_templates FOR SELECT
USING (
  can_view_template(visibility_level, user_id, creator_company_id, creator_department_id)
);

CREATE POLICY "Users can insert their own task_templates"
ON public.task_templates FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update task_templates they can manage"
ON public.task_templates FOR UPDATE
USING (can_manage_template(user_id));

CREATE POLICY "Users can delete task_templates they can manage"
ON public.task_templates FOR DELETE
USING (can_manage_template(user_id));