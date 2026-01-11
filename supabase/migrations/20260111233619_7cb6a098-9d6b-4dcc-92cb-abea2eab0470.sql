-- Drop existing permissive SELECT policies on profiles
DROP POLICY IF EXISTS "Users can view non-private profiles" ON public.profiles;

-- Create new policy: Users can view profiles from their own company
CREATE POLICY "Users can view profiles from same company"
ON public.profiles
FOR SELECT
USING (
  -- User can always view their own profile
  auth.uid() = user_id
  OR
  -- Admins can view all profiles  
  has_role(auth.uid(), 'admin')
  OR
  -- Users can view profiles from same company (if both have a company_id set)
  (
    company_id IS NOT NULL 
    AND company_id IN (
      SELECT p.company_id 
      FROM profiles p 
      WHERE p.user_id = auth.uid() AND p.company_id IS NOT NULL
    )
  )
);

-- Drop the old admin and self view policies since they're now covered
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;