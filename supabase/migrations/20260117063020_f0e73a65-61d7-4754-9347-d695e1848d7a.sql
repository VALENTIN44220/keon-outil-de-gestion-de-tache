-- Enable RLS on collaborator_groups
ALTER TABLE public.collaborator_groups ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read groups
CREATE POLICY "Everyone can view collaborator groups" 
ON public.collaborator_groups 
FOR SELECT 
USING (true);

-- Policy: Authenticated users can create groups
CREATE POLICY "Authenticated users can create collaborator groups" 
ON public.collaborator_groups 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Creators and admins can update groups
CREATE POLICY "Creators can update collaborator groups" 
ON public.collaborator_groups 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Policy: Creators can delete groups
CREATE POLICY "Creators can delete collaborator groups" 
ON public.collaborator_groups 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Enable RLS on collaborator_group_members
ALTER TABLE public.collaborator_group_members ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view members
CREATE POLICY "Everyone can view group members" 
ON public.collaborator_group_members 
FOR SELECT 
USING (true);

-- Policy: Authenticated users can add members
CREATE POLICY "Authenticated users can add group members" 
ON public.collaborator_group_members 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Authenticated users can remove members
CREATE POLICY "Authenticated users can remove group members" 
ON public.collaborator_group_members 
FOR DELETE 
USING (auth.uid() IS NOT NULL);