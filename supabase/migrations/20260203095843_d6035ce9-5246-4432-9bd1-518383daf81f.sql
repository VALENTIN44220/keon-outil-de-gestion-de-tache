-- Fix security issues for profiles, collaborator_groups, and collaborator_group_members tables

-- ============================================
-- 1. FIX PROFILES TABLE RLS POLICIES
-- ============================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can view profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Create more restrictive profile visibility policy
-- Users can only see:
-- 1. Their own profile
-- 2. Their manager's profile
-- 3. Their direct reports' profiles
-- 4. Profiles in the same department AND same company
CREATE POLICY "Restricted profile visibility"
ON public.profiles
FOR SELECT
USING (
  -- Own profile
  auth.uid() = user_id
  OR
  -- User's manager
  id = (SELECT manager_id FROM public.profiles WHERE user_id = auth.uid())
  OR
  -- User's direct reports
  manager_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR
  -- Same department AND same company (both must match, no null bypass)
  (
    company_id IS NOT NULL 
    AND department_id IS NOT NULL
    AND company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    AND department_id = (SELECT department_id FROM public.profiles WHERE user_id = auth.uid())
  )
);

-- ============================================
-- 2. FIX COLLABORATOR_GROUPS TABLE RLS POLICIES
-- ============================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Everyone can view collaborator groups" ON public.collaborator_groups;
DROP POLICY IF EXISTS "Authenticated users can view collaborator groups" ON public.collaborator_groups;
DROP POLICY IF EXISTS "Anyone can view collaborator groups" ON public.collaborator_groups;

-- Create company-restricted read policy
CREATE POLICY "Users can view collaborator groups in their company"
ON public.collaborator_groups
FOR SELECT
USING (
  -- User must be authenticated
  auth.uid() IS NOT NULL
  AND
  (
    -- Group belongs to user's company
    company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    OR
    -- Group belongs to user's department
    department_id = (SELECT department_id FROM public.profiles WHERE user_id = auth.uid())
    OR
    -- User created the group
    created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
);

-- Update insert policy to require company context
DROP POLICY IF EXISTS "Authenticated users can create collaborator groups" ON public.collaborator_groups;
CREATE POLICY "Users can create collaborator groups in their company"
ON public.collaborator_groups
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND
  (
    company_id IS NULL 
    OR company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  )
);

-- Update/delete policies
DROP POLICY IF EXISTS "Authenticated users can update collaborator groups" ON public.collaborator_groups;
DROP POLICY IF EXISTS "Authenticated users can delete collaborator groups" ON public.collaborator_groups;

CREATE POLICY "Users can update collaborator groups they created or in their company"
ON public.collaborator_groups
FOR UPDATE
USING (
  created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can delete collaborator groups they created"
ON public.collaborator_groups
FOR DELETE
USING (
  created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- ============================================
-- 3. FIX COLLABORATOR_GROUP_MEMBERS TABLE RLS POLICIES
-- ============================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Everyone can view collaborator group members" ON public.collaborator_group_members;
DROP POLICY IF EXISTS "Authenticated users can view collaborator group members" ON public.collaborator_group_members;
DROP POLICY IF EXISTS "Anyone can view group members" ON public.collaborator_group_members;

-- Create restricted read policy - only view members of groups you can access
CREATE POLICY "Users can view members of accessible groups"
ON public.collaborator_group_members
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND
  group_id IN (
    SELECT id FROM public.collaborator_groups
    WHERE 
      company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
      OR department_id = (SELECT department_id FROM public.profiles WHERE user_id = auth.uid())
      OR created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
);

-- Update insert policy
DROP POLICY IF EXISTS "Authenticated users can add group members" ON public.collaborator_group_members;
CREATE POLICY "Users can add members to accessible groups"
ON public.collaborator_group_members
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND
  group_id IN (
    SELECT id FROM public.collaborator_groups
    WHERE 
      company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
      OR department_id = (SELECT department_id FROM public.profiles WHERE user_id = auth.uid())
      OR created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
);

-- Update delete policy
DROP POLICY IF EXISTS "Authenticated users can remove group members" ON public.collaborator_group_members;
CREATE POLICY "Users can remove members from accessible groups"
ON public.collaborator_group_members
FOR DELETE
USING (
  auth.uid() IS NOT NULL
  AND
  group_id IN (
    SELECT id FROM public.collaborator_groups
    WHERE 
      company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
      OR department_id = (SELECT department_id FROM public.profiles WHERE user_id = auth.uid())
      OR created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
);