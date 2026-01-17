-- Create a function to get team hierarchy data bypassing RLS
-- This is needed because the profiles table has restrictive RLS
CREATE OR REPLACE FUNCTION public.get_all_profiles_for_hierarchy()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  display_name text,
  avatar_url text,
  job_title text,
  job_title_id uuid,
  department text,
  department_id uuid,
  company text,
  company_id uuid,
  manager_id uuid,
  hierarchy_level_id uuid,
  permission_profile_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.user_id,
    p.display_name,
    p.avatar_url,
    p.job_title,
    p.job_title_id,
    p.department,
    p.department_id,
    p.company,
    p.company_id,
    p.manager_id,
    p.hierarchy_level_id,
    p.permission_profile_id
  FROM public.profiles p
$$;