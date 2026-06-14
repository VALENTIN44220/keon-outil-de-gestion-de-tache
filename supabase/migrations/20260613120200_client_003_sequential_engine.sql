-- CLIENT 003 — Enchaînement séquentiel des approbations du flux "Création client".
-- 1) fn_auto_spawn_child_tasks : pour module 'client', ne spawn que l'étape 0.
-- 2) fn_client_spawn_next_step : à la validation d'une étape, spawn la suivante
--    (étape "Création affaire" uniquement si une affaire est à créer).

CREATE OR REPLACE FUNCTION fn_auto_spawn_child_tasks()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_be_process_id constant uuid := 'bd75a3b0-c918-4b43-befe-739b83f7461a';
  v_support_it_id constant uuid := '47b00c1b-e2a7-4b89-a1ed-a827057b0f8e';
  v_tt RECORD; v_assignee_id uuid; v_group_ids uuid[]; v_already integer;
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
    SELECT tt.title AS tt_title, tt.default_duration_days, tt.priority,
      tt.validation_level_1, tt.validation_level_2, tt.validator_level_1_id, tt.validator_level_2_id,
      tt.order_index, tt.output_state_code,
      sp.id AS sp_id, sp.assignment_type, sp.target_assignee_id, sp.target_group_id
    FROM task_templates tt JOIN sub_process_templates sp ON sp.id = tt.sub_process_template_id
    WHERE sp.process_template_id = NEW.source_process_template_id
      AND (NEW.module_code <> 'client'::module_code OR sp.order_index = 0)
    ORDER BY sp.order_index, tt.order_index
  LOOP
    v_assignee_id := NULL; v_group_ids := NULL;
    IF v_tt.assignment_type IN ('fixed_user','user') THEN v_assignee_id := v_tt.target_assignee_id;
    ELSIF v_tt.assignment_type = 'requester' THEN v_assignee_id := NEW.requester_id;
    ELSIF v_tt.assignment_type IN ('team','group') AND v_tt.target_group_id IS NOT NULL THEN
      SELECT array_agg(m.user_id) INTO v_group_ids FROM collaborator_group_members m WHERE m.group_id = v_tt.target_group_id;
    END IF;

    INSERT INTO tasks (type,status,title,description,priority,requester_id,user_id,assignee_id,group_assignee_ids,parent_request_id,
      source_process_template_id,source_sub_process_template_id,module_code,validation_level_1,validation_level_2,
      validator_level_1_id,validator_level_2_id,output_state_code,due_date)
    VALUES ('task',
      CASE WHEN v_assignee_id IS NOT NULL OR (v_group_ids IS NOT NULL AND array_length(v_group_ids,1)>0) THEN 'todo' ELSE 'to_assign' END,
      COALESCE(NEW.title,'(sans titre)') || ' — ' || v_tt.tt_title, v_tt.tt_title,
      COALESCE(v_tt.priority,NEW.priority,'medium'), NEW.requester_id,NEW.user_id,v_assignee_id,v_group_ids,NEW.id,
      NEW.source_process_template_id,v_tt.sp_id,NEW.module_code,v_tt.validation_level_1,v_tt.validation_level_2,
      v_tt.validator_level_1_id,v_tt.validator_level_2_id,v_tt.output_state_code,
      CASE WHEN v_tt.default_duration_days IS NOT NULL THEN CURRENT_DATE + (v_tt.default_duration_days||' days')::interval ELSE NEW.due_date END);
  END LOOP;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION fn_client_spawn_next_step()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_ord int; v_proc uuid; v_next RECORD; v_req RECORD;
  v_assignee_id uuid; v_group_ids uuid[]; v_tt RECORD; v_wants_affaire boolean;
BEGIN
  IF NEW.module_code <> 'client'::module_code THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('done','validated','realisee','cloturee') THEN RETURN NEW; END IF;
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  IF NEW.source_sub_process_template_id IS NULL OR NEW.parent_request_id IS NULL THEN RETURN NEW; END IF;

  SELECT order_index, process_template_id INTO v_ord, v_proc FROM sub_process_templates WHERE id = NEW.source_sub_process_template_id;
  SELECT * INTO v_next FROM sub_process_templates WHERE process_template_id = v_proc AND order_index > v_ord ORDER BY order_index LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT * INTO v_req FROM tasks WHERE id = NEW.parent_request_id;

  IF v_next.order_index >= 2 THEN
    v_wants_affaire := COALESCE(v_req.module_data->>'affaire_mode','') = 'create'
                       OR COALESCE(NULLIF(v_req.module_data->>'code_affaire_a_creer',''), NULL) IS NOT NULL;
    IF NOT v_wants_affaire THEN RETURN NEW; END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM tasks WHERE parent_request_id = NEW.parent_request_id AND source_sub_process_template_id = v_next.id) THEN
    RETURN NEW;
  END IF;

  v_assignee_id := NULL; v_group_ids := NULL;
  IF v_next.assignment_type IN ('fixed_user','user') THEN v_assignee_id := v_next.target_assignee_id;
  ELSIF v_next.assignment_type = 'requester' THEN v_assignee_id := v_req.requester_id;
  ELSIF v_next.assignment_type IN ('team','group') AND v_next.target_group_id IS NOT NULL THEN
    SELECT array_agg(m.user_id) INTO v_group_ids FROM collaborator_group_members m WHERE m.group_id = v_next.target_group_id;
  END IF;

  FOR v_tt IN SELECT * FROM task_templates WHERE sub_process_template_id = v_next.id ORDER BY order_index LOOP
    INSERT INTO tasks (type,status,title,description,priority,requester_id,user_id,assignee_id,group_assignee_ids,parent_request_id,
      source_process_template_id,source_sub_process_template_id,module_code,validation_level_1,validation_level_2,
      validator_level_1_id,validator_level_2_id,output_state_code,due_date)
    VALUES ('task',
      CASE WHEN v_assignee_id IS NOT NULL OR (v_group_ids IS NOT NULL AND array_length(v_group_ids,1)>0) THEN 'todo' ELSE 'to_assign' END,
      COALESCE(v_req.title,'(sans titre)') || ' — ' || v_tt.title, v_tt.title,
      COALESCE(v_tt.priority, v_req.priority, 'medium'), v_req.requester_id, v_req.user_id, v_assignee_id, v_group_ids, v_req.id,
      v_req.source_process_template_id, v_next.id, v_req.module_code, v_tt.validation_level_1, v_tt.validation_level_2,
      v_tt.validator_level_1_id, v_tt.validator_level_2_id, v_tt.output_state_code, v_req.due_date);
  END LOOP;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_client_spawn_next_step ON tasks;
CREATE TRIGGER trg_client_spawn_next_step
  AFTER UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION fn_client_spawn_next_step();
