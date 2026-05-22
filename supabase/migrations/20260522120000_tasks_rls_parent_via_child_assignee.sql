-- RLS : un exécutant assigné à une SOUS-TÂCHE doit pouvoir LIRE la demande
-- parente (contexte, infos demandeur, pièces jointes de l'onglet "Détail
-- demande"). Auparavant can_access_task() ne propageait l'accès que dans le
-- sens parent → enfant (on peut lire une sous-tâche si on accède au parent),
-- jamais enfant → parent. Adrienne, assignée à une sous-tâche BE, ne pouvait
-- donc pas ouvrir la demande dont elle dépend.
--
-- On réécrit can_access_task() à l'identique en ajoutant UNE condition :
-- si la tâche courante est une demande et que l'utilisateur est assigné à au
-- moins une de ses sous-tâches → accès en lecture autorisé.

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

  -- NOUVEAU : accès enfant → parent.
  -- Si la tâche courante est une demande et que l'utilisateur est assigné à
  -- l'une de ses sous-tâches, il peut lire la demande parente.
  IF EXISTS (
    SELECT 1
    FROM public.tasks c
    WHERE c.parent_request_id = t.id
      AND c.assignee_id IS NOT NULL
      AND c.assignee_id = public.current_profile_id()
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;
