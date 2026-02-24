
-- Fix admin policy: p.id should be p.user_id
DROP POLICY IF EXISTS "Admins can manage group members" ON public.collaborator_group_members;
CREATE POLICY "Admins can manage group members"
ON public.collaborator_group_members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN permission_profiles pp ON p.permission_profile_id = pp.id
    WHERE p.user_id = auth.uid() AND pp.can_manage_users = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN permission_profiles pp ON p.permission_profile_id = pp.id
    WHERE p.user_id = auth.uid() AND pp.can_manage_users = true
  )
);

-- Fix INSERT policy to also allow when group has no company/department (open groups)
DROP POLICY IF EXISTS "Users can add members to accessible groups" ON public.collaborator_group_members;
CREATE POLICY "Users can add members to accessible groups"
ON public.collaborator_group_members
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    group_id IN (
      SELECT cg.id FROM collaborator_groups cg
      WHERE cg.company_id = (SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid())
         OR cg.department_id = (SELECT p.department_id FROM profiles p WHERE p.user_id = auth.uid())
         OR cg.created_by = (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
         OR (cg.company_id IS NULL AND cg.department_id IS NULL)
    )
  )
);

-- Fix DELETE policy similarly
DROP POLICY IF EXISTS "Users can remove members from accessible groups" ON public.collaborator_group_members;
CREATE POLICY "Users can remove members from accessible groups"
ON public.collaborator_group_members
FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    group_id IN (
      SELECT cg.id FROM collaborator_groups cg
      WHERE cg.company_id = (SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid())
         OR cg.department_id = (SELECT p.department_id FROM profiles p WHERE p.user_id = auth.uid())
         OR cg.created_by = (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
         OR (cg.company_id IS NULL AND cg.department_id IS NULL)
    )
  )
);
