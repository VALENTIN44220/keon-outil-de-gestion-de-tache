-- Remove overly permissive SELECT policies
DROP POLICY IF EXISTS "Authenticated users can view collaborator groups" ON public.collaborator_groups;
DROP POLICY IF EXISTS "Authenticated users can view group members" ON public.collaborator_group_members;

-- Remove duplicate permissive DELETE/UPDATE policies (USING true or just auth.uid() IS NOT NULL)
DROP POLICY IF EXISTS "Creators can delete collaborator groups" ON public.collaborator_groups;
DROP POLICY IF EXISTS "Creators can update collaborator groups" ON public.collaborator_groups;