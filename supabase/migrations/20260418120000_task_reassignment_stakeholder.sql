-- Team-lead reassignment follow-up: original assignee stays visible after transfer.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS allows_reassignment boolean NOT NULL DEFAULT false;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS reassignment_stakeholder_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_reassignment_stakeholder_id
  ON public.tasks (reassignment_stakeholder_id)
  WHERE reassignment_stakeholder_id IS NOT NULL;

COMMENT ON COLUMN public.tasks.allows_reassignment IS 'When true (process team_lead_reassignment), first transfer may set reassignment_stakeholder_id to keep prior assignee in the loop.';
COMMENT ON COLUMN public.tasks.reassignment_stakeholder_id IS 'Profile that keeps read access after reassignment (typically prior assignee).';

CREATE OR REPLACE FUNCTION public.can_access_task(_task_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Follow-up visibility after reassignment (team lead / delegation flows)
  IF t.reassignment_stakeholder_id IS NOT NULL AND t.reassignment_stakeholder_id = public.current_profile_id() THEN
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

  -- Process tracking access: users with read access to a process can see all its tasks
  IF t.process_template_id IS NOT NULL AND public.can_read_process_tracking(t.process_template_id) THEN
    RETURN true;
  END IF;
  IF t.source_process_template_id IS NOT NULL AND public.can_read_process_tracking(t.source_process_template_id) THEN
    RETURN true;
  END IF;

  -- Child tasks: access follows parent request access
  IF t.parent_request_id IS NOT NULL THEN
    RETURN public.can_access_task(t.parent_request_id);
  END IF;

  RETURN false;
END;
$function$;
