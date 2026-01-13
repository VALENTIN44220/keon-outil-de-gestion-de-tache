-- Drop existing modification policies on be_projects
DROP POLICY IF EXISTS "Users with create permission can insert BE projects" ON public.be_projects;
DROP POLICY IF EXISTS "Users with edit permission can update BE projects" ON public.be_projects;
DROP POLICY IF EXISTS "Users with delete permission can delete BE projects" ON public.be_projects;

-- Create INSERT policy based on permission profile
CREATE POLICY "Users with create permission can insert BE projects"
ON public.be_projects
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.permission_profiles pp ON p.permission_profile_id = pp.id
    WHERE p.user_id = auth.uid()
      AND pp.can_create_be_projects = true
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Create UPDATE policy based on permission profile
CREATE POLICY "Users with edit permission can update BE projects"
ON public.be_projects
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.permission_profiles pp ON p.permission_profile_id = pp.id
    WHERE p.user_id = auth.uid()
      AND pp.can_edit_be_projects = true
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Create DELETE policy based on permission profile
CREATE POLICY "Users with delete permission can delete BE projects"
ON public.be_projects
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.permission_profiles pp ON p.permission_profile_id = pp.id
    WHERE p.user_id = auth.uid()
      AND pp.can_delete_be_projects = true
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);