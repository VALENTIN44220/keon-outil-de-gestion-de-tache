-- Fix infinite recursion in profiles RLS by using SECURITY DEFINER helper functions

-- Helper: current user's profile id
CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;

-- Helper: current user's company id
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.company_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;

-- Helper: current user's department id
CREATE OR REPLACE FUNCTION public.get_my_department_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.department_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;

-- Helper: current user's manager profile id
CREATE OR REPLACE FUNCTION public.get_my_manager_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.manager_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;

-- Replace the recursive SELECT policy
DROP POLICY IF EXISTS "Restricted profile visibility" ON public.profiles;

CREATE POLICY "Restricted profile visibility"
ON public.profiles
FOR SELECT
TO public
USING (
  -- self
  auth.uid() = user_id
  -- admin can view all profiles (needed for user management)
  OR has_role(auth.uid(), 'admin'::app_role)
  -- manager / subordinate visibility
  OR id = public.get_my_manager_profile_id()
  OR manager_id = public.get_my_profile_id()
  -- colleagues in same company + department
  OR (
    company_id IS NOT NULL
    AND department_id IS NOT NULL
    AND company_id = public.get_my_company_id()
    AND department_id = public.get_my_department_id()
  )
);
