-- Add DELETE policies for admin users on reference tables

-- Departments
CREATE POLICY "Admins can delete departments"
ON public.departments
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Companies
CREATE POLICY "Admins can delete companies"
ON public.companies
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Job Titles
CREATE POLICY "Admins can delete job titles"
ON public.job_titles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Hierarchy Levels
CREATE POLICY "Admins can delete hierarchy levels"
ON public.hierarchy_levels
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Permission Profiles
CREATE POLICY "Admins can delete permission profiles"
ON public.permission_profiles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Categories
CREATE POLICY "Admins can delete categories"
ON public.categories
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Subcategories
CREATE POLICY "Admins can delete subcategories"
ON public.subcategories
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- BE Task Labels
CREATE POLICY "Admins can delete be task labels"
ON public.be_task_labels
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Assignment Rules
CREATE POLICY "Admins can delete assignment rules"
ON public.assignment_rules
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Holidays
CREATE POLICY "Admins can delete holidays"
ON public.holidays
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- BE Projects
CREATE POLICY "Admins can delete be projects"
ON public.be_projects
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Process Templates
CREATE POLICY "Admins can delete process templates"
ON public.process_templates
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Sub Process Templates
CREATE POLICY "Admins can delete sub process templates"
ON public.sub_process_templates
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Task Templates
CREATE POLICY "Admins can delete task templates"
ON public.task_templates
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Visibility junction tables
CREATE POLICY "Admins can delete process template visible companies"
ON public.process_template_visible_companies
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete process template visible departments"
ON public.process_template_visible_departments
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete sub process template visible companies"
ON public.sub_process_template_visible_companies
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete sub process template visible departments"
ON public.sub_process_template_visible_departments
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete task template visible companies"
ON public.task_template_visible_companies
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete task template visible departments"
ON public.task_template_visible_departments
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Template checklists
CREATE POLICY "Admins can delete task template checklists"
ON public.task_template_checklists
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete template validation levels"
ON public.template_validation_levels
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));