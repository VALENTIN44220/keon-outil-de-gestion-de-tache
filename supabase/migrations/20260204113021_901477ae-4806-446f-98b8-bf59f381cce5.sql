-- Fix PUBLIC_GROUP_DATA: collaborator_groups table public exposure
-- Remove overly permissive policy and require authentication

DROP POLICY IF EXISTS "Everyone can view group members" ON public.collaborator_groups;
DROP POLICY IF EXISTS "Authenticated users can view collaborator groups" ON public.collaborator_groups;

CREATE POLICY "Authenticated users can view collaborator groups"
  ON public.collaborator_groups
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Fix PUBLIC_GROUP_MEMBERSHIP: collaborator_group_members table public exposure
-- Remove overly permissive policy and require authentication

DROP POLICY IF EXISTS "Everyone can view group members" ON public.collaborator_group_members;
DROP POLICY IF EXISTS "Authenticated users can view group members" ON public.collaborator_group_members;

CREATE POLICY "Authenticated users can view group members"
  ON public.collaborator_group_members
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Fix PUBLIC_FORM_SECTIONS: form_sections table public exposure
-- Remove overly permissive policy and require authentication

DROP POLICY IF EXISTS "Anyone can view form sections" ON public.form_sections;
DROP POLICY IF EXISTS "Authenticated users can view form sections" ON public.form_sections;

CREATE POLICY "Authenticated users can view form sections"
  ON public.form_sections
  FOR SELECT
  USING (auth.uid() IS NOT NULL);