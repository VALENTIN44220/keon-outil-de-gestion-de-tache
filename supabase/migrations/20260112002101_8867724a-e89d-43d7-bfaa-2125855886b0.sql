-- Fix infinite recursion in profiles RLS by removing policies that query profiles within profiles

-- Helper functions (SECURITY DEFINER) to fetch current user's profile attributes safely
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.company_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_department_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.department_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1
$$;

-- Replace the recursive SELECT policy on profiles
DROP POLICY IF EXISTS "Users can view profiles from same company" ON public.profiles;

CREATE POLICY "Users can view profiles from same company"
ON public.profiles
FOR SELECT
USING (
  (auth.uid() = user_id)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    public.current_company_id() IS NOT NULL
    AND company_id = public.current_company_id()
  )
);

-- Keep existing UPDATE/INSERT policies intact; ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;