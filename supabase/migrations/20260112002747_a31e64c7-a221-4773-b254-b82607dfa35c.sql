-- Fix infinite recursion in tasks RLS policies by using SECURITY DEFINER functions

-- Drop problematic policies that query profiles inside tasks policies
DROP POLICY IF EXISTS "Users can view tasks assigned to them" ON public.tasks;
DROP POLICY IF EXISTS "Users can update tasks assigned to them" ON public.tasks;
DROP POLICY IF EXISTS "Users can view requests for their department" ON public.tasks;
DROP POLICY IF EXISTS "Users can update requests for their department" ON public.tasks;
DROP POLICY IF EXISTS "Users can view child tasks of their requests" ON public.tasks;
DROP POLICY IF EXISTS "Managers can update unassigned tasks for their department" ON public.tasks;

-- Recreate policies using the helper functions we already created

-- Users can view tasks assigned to them
CREATE POLICY "Users can view tasks assigned to them"
ON public.tasks
FOR SELECT
USING (assignee_id = public.current_profile_id());

-- Users can update tasks assigned to them
CREATE POLICY "Users can update tasks assigned to them"
ON public.tasks
FOR UPDATE
USING (assignee_id = public.current_profile_id());

-- Users can view requests for their department
CREATE POLICY "Users can view requests for their department"
ON public.tasks
FOR SELECT
USING (
  type = 'request'
  AND target_department_id = public.current_department_id()
);

-- Users can update requests for their department
CREATE POLICY "Users can update requests for their department"
ON public.tasks
FOR UPDATE
USING (
  type = 'request'
  AND target_department_id = public.current_department_id()
);

-- Users can view child tasks of their requests (simplified - no subquery into profiles)
CREATE POLICY "Users can view child tasks of their requests"
ON public.tasks
FOR SELECT
USING (
  parent_request_id IN (
    SELECT t.id FROM public.tasks t 
    WHERE t.user_id = auth.uid() 
       OR t.assignee_id = public.current_profile_id()
  )
);

-- Managers can update unassigned tasks for their department
-- Create a helper function to check if user can assign
CREATE OR REPLACE FUNCTION public.can_assign_tasks()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.permission_profiles pp ON p.permission_profile_id = pp.id
    WHERE p.user_id = auth.uid()
      AND (pp.can_assign_to_subordinates = true OR pp.can_assign_to_all = true)
  )
$$;

CREATE POLICY "Managers can update unassigned tasks for their department"
ON public.tasks
FOR UPDATE
USING (
  assignee_id IS NULL
  AND target_department_id = public.current_department_id()
  AND public.can_assign_tasks()
);

-- Fix task_checklists policies that also reference profiles via tasks
DROP POLICY IF EXISTS "Users can view checklists of their tasks" ON public.task_checklists;
DROP POLICY IF EXISTS "Users can insert checklists to their tasks" ON public.task_checklists;
DROP POLICY IF EXISTS "Users can update checklists of their tasks" ON public.task_checklists;
DROP POLICY IF EXISTS "Users can delete checklists of their tasks" ON public.task_checklists;

CREATE POLICY "Users can view checklists of their tasks"
ON public.task_checklists
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_checklists.task_id
      AND (t.user_id = auth.uid() OR t.assignee_id = public.current_profile_id())
  )
);

CREATE POLICY "Users can insert checklists to their tasks"
ON public.task_checklists
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_checklists.task_id
      AND (t.user_id = auth.uid() OR t.assignee_id = public.current_profile_id())
  )
);

CREATE POLICY "Users can update checklists of their tasks"
ON public.task_checklists
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_checklists.task_id
      AND (t.user_id = auth.uid() OR t.assignee_id = public.current_profile_id())
  )
);

CREATE POLICY "Users can delete checklists of their tasks"
ON public.task_checklists
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_checklists.task_id
      AND (t.user_id = auth.uid() OR t.assignee_id = public.current_profile_id())
  )
);

-- Fix task_attachments policies
DROP POLICY IF EXISTS "Users can view attachments of their tasks" ON public.task_attachments;
DROP POLICY IF EXISTS "Users can add attachments to accessible tasks" ON public.task_attachments;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON public.task_attachments;

CREATE POLICY "Users can view attachments of their tasks"
ON public.task_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_attachments.task_id
      AND (
        t.user_id = auth.uid() 
        OR t.assignee_id = public.current_profile_id()
        OR (t.type = 'request' AND t.target_department_id = public.current_department_id())
      )
  )
);

CREATE POLICY "Users can add attachments to accessible tasks"
ON public.task_attachments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_attachments.task_id
      AND (
        t.user_id = auth.uid() 
        OR t.assignee_id = public.current_profile_id()
        OR (t.type = 'request' AND t.target_department_id = public.current_department_id())
      )
  )
);

CREATE POLICY "Users can delete their own attachments"
ON public.task_attachments
FOR DELETE
USING (uploaded_by = public.current_profile_id());

-- Fix task_validation_levels policies
DROP POLICY IF EXISTS "Users can view validation levels of accessible tasks" ON public.task_validation_levels;
DROP POLICY IF EXISTS "Validators can update their validation levels" ON public.task_validation_levels;

CREATE POLICY "Users can view validation levels of accessible tasks"
ON public.task_validation_levels
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_validation_levels.task_id
      AND (
        t.user_id = auth.uid() 
        OR t.assignee_id = public.current_profile_id()
        OR t.validator_id = public.current_profile_id()
      )
  )
);

CREATE POLICY "Validators can update their validation levels"
ON public.task_validation_levels
FOR UPDATE
USING (
  validator_id = public.current_profile_id()
  OR validator_department_id = public.current_department_id()
);