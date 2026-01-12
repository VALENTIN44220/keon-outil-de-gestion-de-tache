-- Create junction tables for template visibility with multiple companies/departments

-- Process templates visibility targets
CREATE TABLE public.process_template_visible_companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_template_id UUID NOT NULL REFERENCES public.process_templates(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(process_template_id, company_id)
);

CREATE TABLE public.process_template_visible_departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_template_id UUID NOT NULL REFERENCES public.process_templates(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(process_template_id, department_id)
);

-- Sub-process templates visibility targets
CREATE TABLE public.sub_process_template_visible_companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sub_process_template_id UUID NOT NULL REFERENCES public.sub_process_templates(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sub_process_template_id, company_id)
);

CREATE TABLE public.sub_process_template_visible_departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sub_process_template_id UUID NOT NULL REFERENCES public.sub_process_templates(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sub_process_template_id, department_id)
);

-- Task templates visibility targets
CREATE TABLE public.task_template_visible_companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_template_id UUID NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_template_id, company_id)
);

CREATE TABLE public.task_template_visible_departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_template_id UUID NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_template_id, department_id)
);

-- Enable RLS on all new tables
ALTER TABLE public.process_template_visible_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_template_visible_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_process_template_visible_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_process_template_visible_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_template_visible_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_template_visible_departments ENABLE ROW LEVEL SECURITY;

-- RLS policies for process_template_visible_companies
CREATE POLICY "Users can view visible companies for accessible templates"
ON public.process_template_visible_companies FOR SELECT
USING (true);

CREATE POLICY "Template owners can manage visible companies"
ON public.process_template_visible_companies FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.process_templates pt
    WHERE pt.id = process_template_id
    AND public.can_manage_template(pt.user_id)
  )
);

-- RLS policies for process_template_visible_departments
CREATE POLICY "Users can view visible departments for accessible templates"
ON public.process_template_visible_departments FOR SELECT
USING (true);

CREATE POLICY "Template owners can manage visible departments"
ON public.process_template_visible_departments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.process_templates pt
    WHERE pt.id = process_template_id
    AND public.can_manage_template(pt.user_id)
  )
);

-- RLS policies for sub_process_template_visible_companies
CREATE POLICY "Users can view visible companies for sub-process templates"
ON public.sub_process_template_visible_companies FOR SELECT
USING (true);

CREATE POLICY "Template owners can manage sub-process visible companies"
ON public.sub_process_template_visible_companies FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.sub_process_templates spt
    WHERE spt.id = sub_process_template_id
    AND public.can_manage_template(spt.user_id)
  )
);

-- RLS policies for sub_process_template_visible_departments
CREATE POLICY "Users can view visible departments for sub-process templates"
ON public.sub_process_template_visible_departments FOR SELECT
USING (true);

CREATE POLICY "Template owners can manage sub-process visible departments"
ON public.sub_process_template_visible_departments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.sub_process_templates spt
    WHERE spt.id = sub_process_template_id
    AND public.can_manage_template(spt.user_id)
  )
);

-- RLS policies for task_template_visible_companies
CREATE POLICY "Users can view visible companies for task templates"
ON public.task_template_visible_companies FOR SELECT
USING (true);

CREATE POLICY "Template owners can manage task visible companies"
ON public.task_template_visible_companies FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.task_templates tt
    WHERE tt.id = task_template_id
    AND public.can_manage_template(tt.user_id)
  )
);

-- RLS policies for task_template_visible_departments
CREATE POLICY "Users can view visible departments for task templates"
ON public.task_template_visible_departments FOR SELECT
USING (true);

CREATE POLICY "Template owners can manage task visible departments"
ON public.task_template_visible_departments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.task_templates tt
    WHERE tt.id = task_template_id
    AND public.can_manage_template(tt.user_id)
  )
);

-- Update can_view_template function to check junction tables
CREATE OR REPLACE FUNCTION public.can_view_template(
  _visibility template_visibility, 
  _creator_id uuid, 
  _creator_company_id uuid, 
  _creator_department_id uuid,
  _template_type text DEFAULT 'process',
  _template_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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
      RETURN false;
    WHEN 'internal_department' THEN
      -- Check if user's department is in the visible departments list
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
      -- Fallback to creator's department
      RETURN _current_department_id IS NOT NULL AND _current_department_id = _creator_department_id;
    WHEN 'internal_company' THEN
      -- Check if user's company is in the visible companies list
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
      -- Fallback to creator's company
      RETURN _current_company_id IS NOT NULL AND _current_company_id = _creator_company_id;
    WHEN 'public' THEN
      RETURN true;
    ELSE
      RETURN false;
  END CASE;
END;
$$;