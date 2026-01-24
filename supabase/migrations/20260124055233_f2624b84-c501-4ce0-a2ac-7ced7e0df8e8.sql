-- Fix security issue: Require authentication for all template visibility checks
-- Using CREATE OR REPLACE to avoid dependency issues with existing RLS policies

-- Update the base function with authentication requirement
CREATE OR REPLACE FUNCTION public.can_view_template(_visibility template_visibility, _creator_id uuid, _creator_company_id uuid, _creator_department_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _current_user_id uuid;
  _current_company_id uuid;
  _current_department_id uuid;
  _is_admin boolean;
BEGIN
  _current_user_id := auth.uid();
  
  -- SECURITY FIX: Require authentication for all template access
  IF _current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
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
      RETURN false;
    WHEN 'internal_department' THEN
      RETURN _current_department_id IS NOT NULL AND _current_department_id = _creator_department_id;
    WHEN 'internal_company' THEN
      RETURN _current_company_id IS NOT NULL AND _current_company_id = _creator_company_id;
    WHEN 'public' THEN
      RETURN true; -- Now only authenticated users reach this point
    ELSE
      RETURN false;
  END CASE;
END;
$function$;

-- Update the extended function with template-specific visibility checks
CREATE OR REPLACE FUNCTION public.can_view_template(_visibility template_visibility, _creator_id uuid, _creator_company_id uuid, _creator_department_id uuid, _template_type text DEFAULT 'process'::text, _template_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _current_user_id uuid;
  _current_company_id uuid;
  _current_department_id uuid;
  _is_admin boolean;
BEGIN
  _current_user_id := auth.uid();
  
  -- SECURITY FIX: Require authentication for all template access
  IF _current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
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
      RETURN false;
    WHEN 'internal_department' THEN
      IF _template_id IS NOT NULL THEN
        IF _template_type = 'process' THEN
          RETURN EXISTS (
            SELECT 1 FROM public.process_template_visible_departments
            WHERE process_template_id = _template_id AND department_id = _current_department_id
          );
        ELSIF _template_type = 'sub_process' THEN
          RETURN EXISTS (
            SELECT 1 FROM public.sub_process_template_visible_departments
            WHERE sub_process_template_id = _template_id AND department_id = _current_department_id
          );
        ELSIF _template_type = 'task' THEN
          RETURN EXISTS (
            SELECT 1 FROM public.task_template_visible_departments
            WHERE task_template_id = _template_id AND department_id = _current_department_id
          );
        END IF;
      END IF;
      RETURN _current_department_id IS NOT NULL AND _current_department_id = _creator_department_id;
    WHEN 'internal_company' THEN
      IF _template_id IS NOT NULL THEN
        IF _template_type = 'process' THEN
          RETURN EXISTS (
            SELECT 1 FROM public.process_template_visible_companies
            WHERE process_template_id = _template_id AND company_id = _current_company_id
          );
        ELSIF _template_type = 'sub_process' THEN
          RETURN EXISTS (
            SELECT 1 FROM public.sub_process_template_visible_companies
            WHERE sub_process_template_id = _template_id AND company_id = _current_company_id
          );
        ELSIF _template_type = 'task' THEN
          RETURN EXISTS (
            SELECT 1 FROM public.task_template_visible_companies
            WHERE task_template_id = _template_id AND company_id = _current_company_id
          );
        END IF;
      END IF;
      RETURN _current_company_id IS NOT NULL AND _current_company_id = _creator_company_id;
    WHEN 'public' THEN
      RETURN true; -- Now only authenticated users reach this point
    ELSE
      RETURN false;
  END CASE;
END;
$function$;

-- Fix RLS policy for template_custom_fields table
ALTER TABLE public.template_custom_fields ENABLE ROW LEVEL SECURITY;

-- Drop any existing permissive policies that allow public access
DROP POLICY IF EXISTS "Anyone can view template custom fields" ON public.template_custom_fields;
DROP POLICY IF EXISTS "Public can view template custom fields" ON public.template_custom_fields;
DROP POLICY IF EXISTS "Authenticated users can view custom fields" ON public.template_custom_fields;

-- Create new policy requiring authentication for SELECT
CREATE POLICY "Authenticated users can view custom fields"
  ON public.template_custom_fields
  FOR SELECT
  USING (auth.uid() IS NOT NULL);