-- ============================================================================
-- ASSIGN 001 — Moteur d'affectation configurable par sous-processus :
--   personne (fixed_user/user) · groupe (team/group) · demandeur (requester)
--   · dispatch interne (manager_dispatch/manager/fixed_role → to_assign).
--
-- (Appliqué en prod via MCP : assign_001/001b/003 — fichier consolidé.)
-- ============================================================================

-- 1) Vocabulaire assignment_type : accepte base (legacy) ET UI admin.
ALTER TABLE sub_process_templates DROP CONSTRAINT IF EXISTS chk_assignment_type;
ALTER TABLE sub_process_templates ADD CONSTRAINT chk_assignment_type
  CHECK (assignment_type = ANY (ARRAY[
    'fixed_user','fixed_role','team','manager_dispatch',
    'user','manager','group','requester'
  ]));

-- 2) Trigger d'auto-spawn : résout l'affectation par sous-processus.
CREATE OR REPLACE FUNCTION fn_auto_spawn_child_tasks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_be_process_id constant uuid := 'bd75a3b0-c918-4b43-befe-739b83f7461a';
  v_support_it_id constant uuid := '47b00c1b-e2a7-4b89-a1ed-a827057b0f8e';
  v_tt RECORD;
  v_assignee_id uuid;
  v_group_ids uuid[];
  v_already integer;
BEGIN
  IF NEW.type IS DISTINCT FROM 'request' THEN RETURN NEW; END IF;
  IF NEW.source_process_template_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.source_process_template_id = v_be_process_id THEN RETURN NEW; END IF;
  IF NEW.source_process_template_id = v_support_it_id THEN RETURN NEW; END IF;
  IF NEW.module_code = 'be'::module_code THEN RETURN NEW; END IF;
  IF NEW.status IN ('done','cloturee','validated','realisee','cancelled','refused') THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_already FROM tasks WHERE parent_request_id = NEW.id;
  IF v_already > 0 THEN RETURN NEW; END IF;

  FOR v_tt IN
    SELECT
      tt.id AS tt_id, tt.title AS tt_title, tt.default_duration_days, tt.priority,
      tt.validation_level_1, tt.validation_level_2, tt.validator_level_1_id, tt.validator_level_2_id,
      tt.order_index, tt.output_state_code,
      sp.id AS sp_id, sp.assignment_type, sp.target_assignee_id, sp.target_manager_id, sp.target_group_id
    FROM task_templates tt
    JOIN sub_process_templates sp ON sp.id = tt.sub_process_template_id
    WHERE sp.process_template_id = NEW.source_process_template_id
    ORDER BY sp.order_index, tt.order_index
  LOOP
    v_assignee_id := NULL;
    v_group_ids := NULL;

    IF v_tt.assignment_type IN ('fixed_user','user') THEN
      v_assignee_id := v_tt.target_assignee_id;
    ELSIF v_tt.assignment_type = 'requester' THEN
      v_assignee_id := NEW.requester_id;
    ELSIF v_tt.assignment_type IN ('team','group') AND v_tt.target_group_id IS NOT NULL THEN
      -- collaborator_group_members.user_id EST un profiles.id
      SELECT array_agg(m.user_id) INTO v_group_ids
        FROM collaborator_group_members m WHERE m.group_id = v_tt.target_group_id;
    END IF;
    -- tout autre cas (manager_dispatch/manager/fixed_role/NULL) -> to_assign

    INSERT INTO tasks (
      type, status, title, description, priority,
      requester_id, user_id, assignee_id, group_assignee_ids, parent_request_id,
      source_process_template_id, source_sub_process_template_id, module_code,
      validation_level_1, validation_level_2, validator_level_1_id, validator_level_2_id,
      output_state_code, due_date
    )
    VALUES (
      'task',
      CASE WHEN v_assignee_id IS NOT NULL OR (v_group_ids IS NOT NULL AND array_length(v_group_ids,1) > 0)
           THEN 'todo' ELSE 'to_assign' END,
      COALESCE(NEW.title, '(sans titre)') || ' — ' || v_tt.tt_title,
      v_tt.tt_title,
      COALESCE(v_tt.priority, NEW.priority, 'medium'),
      NEW.requester_id, NEW.user_id, v_assignee_id, v_group_ids, NEW.id,
      NEW.source_process_template_id, v_tt.sp_id, NEW.module_code,
      v_tt.validation_level_1, v_tt.validation_level_2,
      v_tt.validator_level_1_id, v_tt.validator_level_2_id,
      v_tt.output_state_code,
      CASE WHEN v_tt.default_duration_days IS NOT NULL
        THEN CURRENT_DATE + (v_tt.default_duration_days || ' days')::interval
        ELSE NEW.due_date END
    );
  END LOOP;
  RETURN NEW;
END;
$$;

-- 3) Visibilité : un membre listé dans group_assignee_ids peut lire la tâche.
CREATE OR REPLACE FUNCTION public.can_access_task(_task_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN RETURN true; END IF;

  SELECT * INTO t FROM public.tasks WHERE id = _task_id;
  IF NOT FOUND THEN RETURN false; END IF;

  IF t.user_id = auth.uid() THEN RETURN true; END IF;
  IF t.assignee_id IS NOT NULL AND t.assignee_id = public.current_profile_id() THEN RETURN true; END IF;
  IF t.reassignment_stakeholder_id IS NOT NULL AND t.reassignment_stakeholder_id = public.current_profile_id() THEN RETURN true; END IF;

  IF t.group_assignee_ids IS NOT NULL AND public.current_profile_id() = ANY (t.group_assignee_ids) THEN
    RETURN true;
  END IF;

  IF t.type = 'task' AND t.assignee_id IS NOT NULL THEN
    IF public.current_profile_global_task_read() THEN RETURN true; END IF;
    IF public.profile_is_manager_ancestor_of(t.assignee_id, public.current_profile_id())
       AND public.current_profile_team_task_hierarchy_read() THEN RETURN true; END IF;
  END IF;

  IF t.type = 'request' AND t.target_department_id IS NOT NULL AND t.target_department_id = public.current_department_id() THEN RETURN true; END IF;
  IF t.assignee_id IS NULL AND t.target_department_id IS NOT NULL AND t.target_department_id = public.current_department_id() AND public.can_assign_tasks() THEN RETURN true; END IF;

  IF t.process_template_id IS NOT NULL AND public.can_read_process_tracking(t.process_template_id) THEN RETURN true; END IF;
  IF t.source_process_template_id IS NOT NULL AND public.can_read_process_tracking(t.source_process_template_id) THEN RETURN true; END IF;

  IF t.parent_request_id IS NOT NULL THEN
    RETURN public.can_access_task(t.parent_request_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tasks c
    WHERE c.parent_request_id = t.id
      AND c.assignee_id IS NOT NULL
      AND c.assignee_id = public.current_profile_id()
  ) THEN RETURN true; END IF;

  RETURN false;
END;
$$;

-- 4) UPDATE : un membre du groupe peut agir sur la tâche.
DROP POLICY IF EXISTS "Group members can update group tasks" ON public.tasks;
CREATE POLICY "Group members can update group tasks"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (group_assignee_ids IS NOT NULL AND public.current_profile_id() = ANY (group_assignee_ids));
