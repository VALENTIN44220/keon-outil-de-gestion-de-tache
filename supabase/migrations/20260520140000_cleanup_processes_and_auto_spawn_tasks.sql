-- ════════════════════════════════════════════════════════════════════════
-- Nettoyage des process_templates orphelins (doublons) + auto-spawn de
-- tâches enfant à partir des task_templates lors de la création d'une demande.
--
-- Contexte : la plupart des process « simples » (IT, Maintenance, Logistique)
-- n'avaient aucun task_template configuré → les demandes étaient créées sans
-- tâches enfant, contrairement aux flux BE / SUPPORT IT/DIGITAL.
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1. Supprime les doublons orphelins (aucun sp + aucune demande) ──────
DELETE FROM process_templates
WHERE id IN (
  '322126a5-0786-46f1-8afd-befa3371d52f',  -- COMMERCIAL
  '593efe0b-855e-4b88-943c-320082d6e4c4',  -- Intelligence artificielle
  'd7dd0903-a662-4c81-81a1-e91fdc5c0f18',  -- RESSOURCES HUMAINES
  '85d98330-229f-40b4-9bf3-368e5dab3e56',  -- TRANSPORT
  '11111111-1111-4111-8111-111111111601',  -- RH - Onboarding (stub)
  '11111111-1111-4111-8111-111111111602',  -- RH - Offboarding (stub)
  '11111111-1111-4111-8111-111111111603',  -- RH - Mutation (stub)
  '11111111-1111-4111-8111-111111111604',  -- RH - Promotion (stub)
  '11111111-1111-4111-8111-111111111401',  -- Comm - Demande communication marketing
  '11111111-1111-4111-8111-111111111402',  -- Comm - Reservation stand nomade
  '11111111-1111-4111-8111-111111111501',  -- Innovation - Nouvelle demande
  '11111111-1111-4111-8111-111111111502'   -- Innovation - MAJ avancement projet
);

-- ─── 2. Seed minimal pour les 11 stubs actifs (IT + Maintenance + Logistique) ──
-- Chaque process reçoit 1 sub_process_template "Traitement de la demande"
-- + 1 task_template "Réalisation" avec validation_level_1='requester'.
DO $$
DECLARE
  v_admin_user uuid := 'cf8822d4-eb83-4605-982e-cf09a363cff1';
BEGIN
  WITH sp_inserts AS (
    INSERT INTO sub_process_templates (process_template_id, name, description, assignment_type, target_assignee_id, order_index, is_mandatory, visibility_level, user_id)
    VALUES
      ('11111111-1111-4111-8111-111111111301', 'Traitement de la demande', 'Étapes standard', 'fixed_user', '49d0e4b8-4c32-405f-8c9c-0c5a1fac334e', 0, true, 'public', v_admin_user),
      ('11111111-1111-4111-8111-111111111302', 'Traitement de la demande', 'Étapes standard', 'fixed_user', '9144d1ff-71dd-4273-8b58-54927ad87773', 0, true, 'public', v_admin_user),
      ('11111111-1111-4111-8111-111111111303', 'Traitement de la demande', 'Étapes standard', 'fixed_user', '9144d1ff-71dd-4273-8b58-54927ad87773', 0, true, 'public', v_admin_user),
      ('11111111-1111-4111-8111-111111111304', 'Traitement de la demande', 'Étapes standard', 'fixed_user', '791009d8-65f2-40ac-be5f-d0c468df1480', 0, true, 'public', v_admin_user),
      ('11111111-1111-4111-8111-111111111305', 'Traitement de la demande', 'Étapes standard', 'fixed_user', '9144d1ff-71dd-4273-8b58-54927ad87773', 0, true, 'public', v_admin_user),
      ('11111111-1111-4111-8111-111111111306', 'Traitement de la demande', 'Étapes standard', 'fixed_user', '49d0e4b8-4c32-405f-8c9c-0c5a1fac334e', 0, true, 'public', v_admin_user),
      ('11111111-1111-4111-8111-111111111307', 'Traitement de la demande', 'Étapes standard', 'fixed_user', '49d0e4b8-4c32-405f-8c9c-0c5a1fac334e', 0, true, 'public', v_admin_user),
      ('11111111-1111-4111-8111-111111111308', 'Traitement de la demande', 'Étapes standard', 'fixed_user', '49d0e4b8-4c32-405f-8c9c-0c5a1fac334e', 0, true, 'public', v_admin_user),
      ('11111111-1111-4111-8111-111111111309', 'Traitement de la demande', 'Étapes standard', 'fixed_user', '81750c79-efb6-48e2-8788-0ec9a6f13b68', 0, true, 'public', v_admin_user),
      ('11111111-1111-4111-8111-111111111310', 'Traitement de la demande', 'Étapes standard', 'fixed_user', '81750c79-efb6-48e2-8788-0ec9a6f13b68', 0, true, 'public', v_admin_user),
      ('11111111-1111-4111-8111-111111111101', 'Traitement de la demande', 'Étapes standard', 'fixed_user', '497bf141-cdaf-4984-918d-8d86f8dbebf1', 0, true, 'public', v_admin_user),
      ('11111111-1111-4111-8111-111111111201', 'Traitement de la demande', 'Étapes standard', 'fixed_user', '497bf141-cdaf-4984-918d-8d86f8dbebf1', 0, true, 'public', v_admin_user)
    ON CONFLICT DO NOTHING
    RETURNING id, process_template_id
  )
  INSERT INTO task_templates (sub_process_template_id, process_template_id, title, description, priority, default_duration_days, default_duration_unit, order_index, start_mode, validation_level_1, validation_level_2, visibility_level, user_id)
  SELECT
    sp.id, sp.process_template_id,
    'Réalisation',
    'Effectuer le travail demandé puis soumettre à validation du demandeur.',
    'medium', 3, 'days', 0, 'parallel',
    'requester', 'none',
    'public'::template_visibility,
    v_admin_user
  FROM sp_inserts sp;
END $$;

-- ─── 3. Trigger d'auto-spawn des tâches enfant à la création d'une demande ────
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
  v_already integer;
BEGIN
  IF NEW.type IS DISTINCT FROM 'request' THEN RETURN NEW; END IF;
  IF NEW.source_process_template_id IS NULL THEN RETURN NEW; END IF;
  -- BE : spawn manuel via NewBERequestDialog ; SUPPORT IT/DIGITAL : multi-prestation
  -- sans mapping prestation→sub_process (à réactiver quand mapping fait)
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
      tt.order_index, tt.target_group_id AS tt_group, tt.output_state_code,
      sp.id AS sp_id, sp.assignment_type, sp.target_assignee_id, sp.target_manager_id
    FROM task_templates tt
    JOIN sub_process_templates sp ON sp.id = tt.sub_process_template_id
    WHERE sp.process_template_id = NEW.source_process_template_id
    ORDER BY sp.order_index, tt.order_index
  LOOP
    v_assignee_id := CASE
      WHEN v_tt.assignment_type = 'fixed_user' THEN v_tt.target_assignee_id
      ELSE NULL
    END;

    INSERT INTO tasks (
      type, status, title, description, priority,
      requester_id, user_id, assignee_id, parent_request_id,
      source_process_template_id, source_sub_process_template_id, module_code,
      validation_level_1, validation_level_2, validator_level_1_id, validator_level_2_id,
      output_state_code, due_date
    )
    VALUES (
      'task',
      CASE WHEN v_assignee_id IS NOT NULL THEN 'todo' ELSE 'to_assign' END,
      COALESCE(NEW.title, '(sans titre)') || ' — ' || v_tt.tt_title,
      v_tt.tt_title,
      COALESCE(v_tt.priority, NEW.priority, 'medium'),
      NEW.requester_id, NEW.user_id, v_assignee_id, NEW.id,
      NEW.source_process_template_id, v_tt.sp_id, NEW.module_code,
      v_tt.validation_level_1, v_tt.validation_level_2,
      v_tt.validator_level_1_id, v_tt.validator_level_2_id,
      v_tt.output_state_code,
      CASE WHEN v_tt.default_duration_days IS NOT NULL
        THEN CURRENT_DATE + (v_tt.default_duration_days || ' days')::interval
        ELSE NULL END
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_spawn_child_tasks ON tasks;
CREATE TRIGGER trg_auto_spawn_child_tasks
AFTER INSERT ON tasks
FOR EACH ROW
EXECUTE FUNCTION fn_auto_spawn_child_tasks();
