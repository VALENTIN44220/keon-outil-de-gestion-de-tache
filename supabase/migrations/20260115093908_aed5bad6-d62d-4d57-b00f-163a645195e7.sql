-- Fix be_projects RLS: Restrict SELECT to authenticated users only
DROP POLICY IF EXISTS "Everyone in company can view BE projects" ON public.be_projects;

CREATE POLICY "Authenticated users can view BE projects"
ON public.be_projects
FOR SELECT
USING (auth.uid() IS NOT NULL);