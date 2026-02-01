-- Fix infinite recursion in profiles policy
-- The previous policy referenced profiles table within itself

DROP POLICY IF EXISTS "Users can view profiles in their company" ON profiles;

-- Create a security definer function to get user's company_id without triggering RLS
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Now create the policy using the function instead of a subquery
CREATE POLICY "Users can view profiles in their company"
ON profiles FOR SELECT
USING (
  (auth.uid() = user_id) 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (company_id IS NOT NULL AND company_id = get_my_company_id())
  OR (company_id IS NULL AND auth.uid() IS NOT NULL)
);