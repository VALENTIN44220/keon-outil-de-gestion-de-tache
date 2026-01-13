-- Drop the existing permissive SELECT policy
DROP POLICY IF EXISTS "Users can view profiles from same company" ON public.profiles;

-- Create a more restrictive policy: own profile OR admin only
CREATE POLICY "Users can view own profile or admins see all"
ON public.profiles
FOR SELECT
USING (
  (auth.uid() = user_id) 
  OR has_role(auth.uid(), 'admin'::app_role)
);