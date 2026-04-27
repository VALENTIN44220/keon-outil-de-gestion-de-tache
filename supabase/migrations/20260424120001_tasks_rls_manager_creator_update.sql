-- RLS: managers / créateurs peuvent mettre à jour les tâches de l’équipe + WITH CHECK basé sur can_access_task.
-- Étend can_access_task pour la lecture des tâches assignées à la hiérarchie (tableau de bord équipe).

CREATE OR REPLACE FUNCTION public.profile_is_manager_ancestor_of(
  _assignee_profile_id uuid,
  _potential_manager_profile_id uuid
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mid uuid;
  hops integer := 0;
BEGIN
  IF _assignee_profile_id IS NULL OR _potential_manager_profile_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT p.manager_id INTO mid
  FROM public.profiles p
  WHERE p.id = _assignee_profile_id;

  WHILE mid IS NOT NULL AND hops < 100 LOOP
    IF mid = _potential_manager_profile_id THEN
      RETURN true;
    END IF;
    SELECT p.manager_id INTO mid FROM public.profiles p WHERE p.id = mid;
    hops := hops + 1;
  END LOOP;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_profile_global_task_read()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles me
    JOIN public.permission_profiles pp ON pp.id = me.permission_profile_id
    WHERE me.user_id = auth.uid()
      AND (pp.can_view_all_tasks OR pp.can_manage_all_tasks)
  );
$$;

CREATE OR REPLACE FUNCTION public.current_profile_team_task_hierarchy_read()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles me
    JOIN public.permission_profiles pp ON pp.id = me.permission_profile_id
    WHERE me.user_id = auth.uid()
      AND (
        pp.can_view_subordinates_tasks
        OR pp.can_assign_to_subordinates
        OR pp.can_assign_to_all
        OR pp.can_manage_subordinates_tasks
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.current_profile_team_task_hierarchy_mutate()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles me
    JOIN public.permission_profiles pp ON pp.id = me.permission_profile_id
    WHERE me.user_id = auth.uid()
      AND (
        pp.can_assign_to_subordinates
        OR pp.can_assign_to_all
        OR pp.can_manage_subordinates_tasks
        OR pp.can_manage_all_tasks
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_task(_task_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t record;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN true;
  END IF;

  SELECT * INTO t FROM public.tasks WHERE id = _task_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF t.user_id = auth.uid() THEN
    RETURN true;
  END IF;

  IF t.assignee_id IS NOT NULL AND t.assignee_id = public.current_profile_id() THEN
    RETURN true;
  END IF;

  IF t.reassignment_stakeholder_id IS NOT NULL AND t.reassignment_stakeholder_id = public.current_profile_id() THEN
    RETURN true;
  END IF;

  IF t.type = 'task' AND t.assignee_id IS NOT NULL THEN
    IF public.current_profile_global_task_read() THEN
      RETURN true;
    END IF;
    IF
      public.profile_is_manager_ancestor_of(t.assignee_id, public.current_profile_id())
      AND public.current_profile_team_task_hierarchy_read()
    THEN
      RETURN true;
    END IF;
  END IF;

  IF t.type = 'request' AND t.target_department_id IS NOT NULL AND t.target_department_id = public.current_department_id() THEN
    RETURN true;
  END IF;

  IF t.assignee_id IS NULL AND t.target_department_id IS NOT NULL AND t.target_department_id = public.current_department_id() AND public.can_assign_tasks() THEN
    RETURN true;
  END IF;

  IF t.process_template_id IS NOT NULL AND public.can_read_process_tracking(t.process_template_id) THEN
    RETURN true;
  END IF;
  IF t.source_process_template_id IS NOT NULL AND public.can_read_process_tracking(t.source_process_template_id) THEN
    RETURN true;
  END IF;

  IF t.parent_request_id IS NOT NULL THEN
    RETURN public.can_access_task(t.parent_request_id);
  END IF;

  RETURN false;
END;
$function$;

DROP POLICY IF EXISTS "Tasks updatable by creator or managing hierarchy" ON public.tasks;
CREATE POLICY "Tasks updatable by creator or managing hierarchy"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR tasks.user_id = auth.uid()
  OR (
    tasks.assignee_id IS NOT NULL
    AND (
      public.current_profile_global_task_read()
      OR (
        public.profile_is_manager_ancestor_of(tasks.assignee_id, public.current_profile_id())
        AND public.current_profile_team_task_hierarchy_mutate()
      )
    )
  )
);

DROP POLICY IF EXISTS "tasks_update_must_remain_accessible" ON public.tasks;
CREATE POLICY "tasks_update_must_remain_accessible"
ON public.tasks
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.can_access_task(tasks.id)
);
