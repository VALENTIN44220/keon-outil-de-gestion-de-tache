
-- ═══════════════════════════════════════
-- 1. SUPPRIMER LES STEPS EN DOUBLON
-- ═══════════════════════════════════════
DO $$
DECLARE v_wf_id UUID;
BEGIN
  SELECT id INTO v_wf_id 
  FROM wf_workflows 
  WHERE sub_process_template_id = 'c1111111-1111-1111-1111-111111111111'
  AND is_active = true LIMIT 1;

  IF v_wf_id IS NULL THEN
    RAISE NOTICE 'No active workflow found, skipping cleanup';
    RETURN;
  END IF;

  DELETE FROM wf_steps 
  WHERE workflow_id = v_wf_id
  AND step_key NOT IN ('start','validation_achat','creation_fournisseur',
                       'attente_infos','refuse','termine');
END $$;

-- ═══════════════════════════════════════
-- 2. CORRIGER LES CONFIG_JSON DES ACTIONS set_field
-- ═══════════════════════════════════════
DO $$
DECLARE v_wf_id UUID;
BEGIN
  SELECT id INTO v_wf_id 
  FROM wf_workflows 
  WHERE sub_process_template_id = 'c1111111-1111-1111-1111-111111111111'
  AND is_active = true LIMIT 1;

  IF v_wf_id IS NULL THEN RETURN; END IF;

  -- start → pending_validation
  UPDATE wf_actions SET config_json = '{"field_name": "status", "field_value": "pending_validation"}'::jsonb
  WHERE workflow_id = v_wf_id AND action_type = 'set_field'
  AND step_key = 'start';

  -- validation_achat → in_progress (transition to creation_fournisseur)
  UPDATE wf_actions SET config_json = '{"field_name": "status", "field_value": "in_progress"}'::jsonb
  WHERE workflow_id = v_wf_id AND action_type = 'set_field'
  AND step_key = 'validation_achat'
  AND transition_id IN (SELECT id FROM wf_transitions WHERE workflow_id = v_wf_id AND to_step_key = 'creation_fournisseur');

  -- → refuse : rejected
  UPDATE wf_actions SET config_json = '{"field_name": "status", "field_value": "rejected"}'::jsonb
  WHERE workflow_id = v_wf_id AND action_type = 'set_field'
  AND transition_id IN (SELECT id FROM wf_transitions WHERE workflow_id = v_wf_id AND to_step_key = 'refuse');

  -- → attente_infos : waiting_for_info
  UPDATE wf_actions SET config_json = '{"field_name": "status", "field_value": "waiting_for_info"}'::jsonb
  WHERE workflow_id = v_wf_id AND action_type = 'set_field'
  AND transition_id IN (SELECT id FROM wf_transitions WHERE workflow_id = v_wf_id AND to_step_key = 'attente_infos');

  -- → termine : completed
  UPDATE wf_actions SET config_json = '{"field_name": "status", "field_value": "completed"}'::jsonb
  WHERE workflow_id = v_wf_id AND action_type = 'set_field'
  AND transition_id IN (SELECT id FROM wf_transitions WHERE workflow_id = v_wf_id AND to_step_key = 'termine');
END $$;

-- ═══════════════════════════════════════
-- 3. CORRIGER LES ACTIONS create_task
-- ═══════════════════════════════════════
DO $$
DECLARE v_wf_id UUID;
BEGIN
  SELECT id INTO v_wf_id FROM wf_workflows 
  WHERE sub_process_template_id = 'c1111111-1111-1111-1111-111111111111'
  AND is_active = true LIMIT 1;

  IF v_wf_id IS NULL THEN RETURN; END IF;

  UPDATE wf_actions 
  SET config_json = '{"task_title": "1.Vérification fournisseur", "target_group_id": "a1111111-1111-1111-1111-111111111111", "template_task_id": "d1111111-1111-1111-1111-111111111111", "is_blocking": true}'::jsonb
  WHERE workflow_id = v_wf_id 
  AND action_type = 'create_task'
  AND step_key = 'start';

  UPDATE wf_actions 
  SET config_json = '{"task_title": "Création fournisseur", "target_group_id": "a2222222-2222-2222-2222-222222222222", "template_task_id": "d2222222-2222-2222-2222-222222222222", "is_blocking": true}'::jsonb
  WHERE workflow_id = v_wf_id 
  AND action_type = 'create_task'
  AND step_key = 'validation_achat';
END $$;

-- ═══════════════════════════════════════
-- 4. AJOUTER VALIDATION ET ASSIGNMENT RULES
-- ═══════════════════════════════════════
DO $$
DECLARE 
  v_wf_id UUID;
  v_step_id UUID;
  v_rule_id UUID;
BEGIN
  SELECT id INTO v_wf_id FROM wf_workflows 
  WHERE sub_process_template_id = 'c1111111-1111-1111-1111-111111111111'
  AND is_active = true LIMIT 1;

  IF v_wf_id IS NULL THEN RETURN; END IF;

  -- Groupe Achat → validation_achat
  SELECT id INTO v_step_id FROM wf_steps 
  WHERE workflow_id = v_wf_id AND step_key = 'validation_achat';

  SELECT id INTO v_rule_id FROM wf_assignment_rules 
  WHERE type = 'group' AND target_id = 'a1111111-1111-1111-1111-111111111111' LIMIT 1;

  IF v_rule_id IS NULL THEN
    INSERT INTO wf_assignment_rules (name, type, target_id)
    VALUES ('Groupe Achat', 'group', 'a1111111-1111-1111-1111-111111111111')
    RETURNING id INTO v_rule_id;
  END IF;

  UPDATE wf_steps SET assignment_rule_id = v_rule_id WHERE id = v_step_id;

  INSERT INTO wf_step_pool_validators (step_id, assignment_rule_id)
  VALUES (v_step_id, v_rule_id)
  ON CONFLICT DO NOTHING;

  -- Groupe Comptabilité → creation_fournisseur
  SELECT id INTO v_step_id FROM wf_steps 
  WHERE workflow_id = v_wf_id AND step_key = 'creation_fournisseur';

  SELECT id INTO v_rule_id FROM wf_assignment_rules 
  WHERE type = 'group' AND target_id = 'a2222222-2222-2222-2222-222222222222' LIMIT 1;

  IF v_rule_id IS NULL THEN
    INSERT INTO wf_assignment_rules (name, type, target_id)
    VALUES ('Groupe Comptabilité', 'group', 'a2222222-2222-2222-2222-222222222222')
    RETURNING id INTO v_rule_id;
  END IF;

  UPDATE wf_steps SET assignment_rule_id = v_rule_id WHERE id = v_step_id;
END $$;

-- ═══════════════════════════════════════
-- 5. CORRIGER LA NOTIFICATION REFUS (couvrir les 2 cas)
-- ═══════════════════════════════════════
DO $$
DECLARE v_wf_id UUID;
BEGIN
  SELECT id INTO v_wf_id FROM wf_workflows 
  WHERE sub_process_template_id = 'c1111111-1111-1111-1111-111111111111'
  AND is_active = true LIMIT 1;

  IF v_wf_id IS NULL THEN RETURN; END IF;

  UPDATE wf_notifications 
  SET body_template = 'Votre demande a été refusée car : {{commentaire_refus}}'
  WHERE workflow_id = v_wf_id AND step_key = 'refuse' AND event = 'enter';
END $$;

-- ═══════════════════════════════════════
-- 6. PUBLIER LE WORKFLOW
-- ═══════════════════════════════════════
UPDATE wf_workflows 
SET is_draft = false, is_active = true, published_at = now()
WHERE sub_process_template_id = 'c1111111-1111-1111-1111-111111111111';
