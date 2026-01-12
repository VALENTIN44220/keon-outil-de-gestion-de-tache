-- Fix remaining infinite recursion on tasks RLS by removing self-referential subqueries

-- Drop SELECT policies on tasks that may reference tasks in subqueries
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view tasks assigned to them" ON public.tasks;
DROP POLICY IF EXISTS "Users can view requests for their department" ON public.tasks;
DROP POLICY IF EXISTS "Users can view child tasks of their requests" ON public.tasks;

-- Create a SECURITY DEFINER function to determine task access without RLS recursion
CREATE OR REPLACE FUNCTION public.can_access_task(_task_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t record;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- Admins can access all tasks
  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN true;
  END IF;

  SELECT * INTO t FROM public.tasks WHERE id = _task_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Owner
  IF t.user_id = auth.uid() THEN
    RETURN true;
  END IF;

  -- Assigned to current user
  IF t.assignee_id IS NOT NULL AND t.assignee_id = public.current_profile_id() THEN
    RETURN true;
  END IF;

  -- Requests visible to target department
  IF t.type = 'request' AND t.target_department_id IS NOT NULL AND t.target_department_id = public.current_department_id() THEN
    RETURN true;
  END IF;

  -- Unassigned tasks visible to managers of that department
  IF t.assignee_id IS NULL AND t.target_department_id IS NOT NULL AND t.target_department_id = public.current_department_id() AND public.can_assign_tasks() THEN
    RETURN true;
  END IF;

  -- Child tasks: access follows parent request access
  IF t.parent_request_id IS NOT NULL THEN
    RETURN public.can_access_task(t.parent_request_id);
  END IF;

  RETURN false;
END;
$$;

-- Single SELECT policy using the helper function
CREATE POLICY "Users can view accessible tasks"
ON public.tasks
FOR SELECT
USING (public.can_access_task(id));

-- Ensure RLS enabled
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;