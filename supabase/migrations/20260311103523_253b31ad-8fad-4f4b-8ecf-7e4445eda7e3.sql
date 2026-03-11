
-- Drop restrictive policies on task_checklists
DROP POLICY IF EXISTS "Users can view checklists of their tasks" ON public.task_checklists;
DROP POLICY IF EXISTS "Users can insert checklists to their tasks" ON public.task_checklists;
DROP POLICY IF EXISTS "Users can update checklists of their tasks" ON public.task_checklists;
DROP POLICY IF EXISTS "Users can delete checklists of their tasks" ON public.task_checklists;

-- Recreate policies using can_access_task() to match tasks table access
CREATE POLICY "Users can view checklists of accessible tasks"
  ON public.task_checklists FOR SELECT
  TO authenticated
  USING (can_access_task(task_id));

CREATE POLICY "Users can insert checklists to accessible tasks"
  ON public.task_checklists FOR INSERT
  TO authenticated
  WITH CHECK (can_access_task(task_id));

CREATE POLICY "Users can update checklists of accessible tasks"
  ON public.task_checklists FOR UPDATE
  TO authenticated
  USING (can_access_task(task_id));

CREATE POLICY "Users can delete checklists of accessible tasks"
  ON public.task_checklists FOR DELETE
  TO authenticated
  USING (can_access_task(task_id));
