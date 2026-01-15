-- Fix RLS policies: Restrict all reference tables to authenticated users only

-- 1. departments table
DROP POLICY IF EXISTS "Everyone can view departments" ON public.departments;
CREATE POLICY "Authenticated users can view departments"
ON public.departments FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 2. companies table
DROP POLICY IF EXISTS "Everyone can view companies" ON public.companies;
CREATE POLICY "Authenticated users can view companies"
ON public.companies FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 3. job_titles table
DROP POLICY IF EXISTS "Everyone can view job_titles" ON public.job_titles;
CREATE POLICY "Authenticated users can view job_titles"
ON public.job_titles FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 4. hierarchy_levels table
DROP POLICY IF EXISTS "Everyone can view hierarchy_levels" ON public.hierarchy_levels;
CREATE POLICY "Authenticated users can view hierarchy_levels"
ON public.hierarchy_levels FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 5. permission_profiles table
DROP POLICY IF EXISTS "Everyone can view permission_profiles" ON public.permission_profiles;
CREATE POLICY "Authenticated users can view permission_profiles"
ON public.permission_profiles FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 6. categories table
DROP POLICY IF EXISTS "Everyone can view categories" ON public.categories;
CREATE POLICY "Authenticated users can view categories"
ON public.categories FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 7. subcategories table
DROP POLICY IF EXISTS "Everyone can view subcategories" ON public.subcategories;
CREATE POLICY "Authenticated users can view subcategories"
ON public.subcategories FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 8. be_task_labels table
DROP POLICY IF EXISTS "Everyone can view BE task labels" ON public.be_task_labels;
CREATE POLICY "Authenticated users can view BE task labels"
ON public.be_task_labels FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 9. assignment_rules table
DROP POLICY IF EXISTS "Everyone can view active assignment_rules" ON public.assignment_rules;
CREATE POLICY "Authenticated users can view active assignment_rules"
ON public.assignment_rules FOR SELECT
USING (auth.uid() IS NOT NULL AND is_active = true);

-- 10. holidays table
DROP POLICY IF EXISTS "Holidays are viewable by authenticated users" ON public.holidays;
CREATE POLICY "Authenticated users can view holidays"
ON public.holidays FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 11. Template visibility junction tables - also restrict to authenticated users
DROP POLICY IF EXISTS "Users can view visible companies for accessible templates" ON public.process_template_visible_companies;
CREATE POLICY "Authenticated users can view process template visible companies"
ON public.process_template_visible_companies FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view visible departments for accessible templates" ON public.process_template_visible_departments;
CREATE POLICY "Authenticated users can view process template visible departments"
ON public.process_template_visible_departments FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view visible companies for sub-process templates" ON public.sub_process_template_visible_companies;
CREATE POLICY "Authenticated users can view sub-process template visible companies"
ON public.sub_process_template_visible_companies FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view visible departments for sub-process templates" ON public.sub_process_template_visible_departments;
CREATE POLICY "Authenticated users can view sub-process template visible departments"
ON public.sub_process_template_visible_departments FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view visible companies for task templates" ON public.task_template_visible_companies;
CREATE POLICY "Authenticated users can view task template visible companies"
ON public.task_template_visible_companies FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view visible departments for task templates" ON public.task_template_visible_departments;
CREATE POLICY "Authenticated users can view task template visible departments"
ON public.task_template_visible_departments FOR SELECT
USING (auth.uid() IS NOT NULL);