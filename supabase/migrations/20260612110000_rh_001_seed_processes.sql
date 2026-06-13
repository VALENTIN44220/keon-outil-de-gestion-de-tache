-- ============================================================================
-- RH 001 — Seed des 4 process RH (Onboarding / Offboarding / Mutation /
-- Promotion) selon docs/CDC/RH_ONBOARDING.md.
--
-- Décisions métier (2026-06-12) :
--  - Demandeurs : service RH uniquement (visibilité process restreinte au
--    département « Ressources Humaines »)
--  - Sous-tâches toutes en parallèle, spawn auto à la création (trigger)
--  - Échéance des sous-tâches = due_date de la demande (date contrat)
--  - Validateur N1 unique : Audrey KABORE (admins en secours)
--  - Suppression des process legacy ONBOARDING / SERVICE MARKETING (0 demande)
-- ============================================================================

-- ─── 0. Suppression des process legacy sans demandes rattachées ─────────────
DELETE FROM task_templates       WHERE process_template_id IN ('128268b0-e9d0-42b2-bc98-8de667671f9c','a87c0649-2a71-471e-95e4-7e0ae68f5cf8');
DELETE FROM sub_process_templates WHERE process_template_id IN ('128268b0-e9d0-42b2-bc98-8de667671f9c','a87c0649-2a71-471e-95e4-7e0ae68f5cf8');
DELETE FROM process_templates     WHERE id IN ('128268b0-e9d0-42b2-bc98-8de667671f9c','a87c0649-2a71-471e-95e4-7e0ae68f5cf8');

-- ─── 1. Le trigger d'auto-spawn hérite la due_date de la demande ─────────────
-- (auparavant : NULL quand pas de durée standard)
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
        ELSE NEW.due_date END
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- ─── 2. Process templates RH ─────────────────────────────────────────────────
DO $$
DECLARE
  v_user_id uuid;
  v_audrey constant uuid := '791009d8-65f2-40ac-be5f-d0c468df1480'; -- KABORE Audrey (profile)
  v_dept_rh    constant uuid := 'c66b703e-e3c9-4e12-84ef-20ee6ff157a6'; -- Ressources Humaines
  v_dept_it    constant uuid := 'aaf5581f-e88c-41a5-bc2c-2429e115f0d4'; -- Service IT/DIGITAL
  v_dept_sg    constant uuid := 'bf2b99fc-eec9-44f2-9738-a5b23d9bee11'; -- SG
  v_dept_comm  constant uuid := '894745be-e528-4d7b-8483-7986d225f440'; -- Communication et Marketing
  v_dept_compta constant uuid := 'c1400dcd-52af-42db-8cdc-80e22173b076'; -- Comptabilité
  v_dept_regl  constant uuid := 'f4d32a6c-9f08-476b-9990-dcb6658a389d'; -- Reglementation
  sp RECORD;
BEGIN
  SELECT user_id INTO v_user_id FROM process_templates WHERE user_id IS NOT NULL LIMIT 1;
  IF v_user_id IS NULL THEN
    SELECT user_id INTO v_user_id FROM profiles LIMIT 1;
  END IF;

  INSERT INTO process_templates (id, name, description, user_id, is_shared, visibility_level, recurrence_enabled, created_at, updated_at)
  VALUES
    ('11111111-1111-4111-8111-111111111601', 'RH - Onboarding',  'Arrivée nouveau collaborateur',          v_user_id, true, 'public', false, now(), now()),
    ('11111111-1111-4111-8111-111111111602', 'RH - Offboarding', 'Départ collaborateur',                    v_user_id, true, 'public', false, now(), now()),
    ('11111111-1111-4111-8111-111111111603', 'RH - Mutation',    'Changement société/poste/manager interne', v_user_id, true, 'public', false, now(), now()),
    ('11111111-1111-4111-8111-111111111604', 'RH - Promotion',   'Évolution de poste interne',              v_user_id, true, 'public', false, now(), now())
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, updated_at = now();

  -- Demandeurs : RH uniquement → visibilité process restreinte au département RH
  INSERT INTO process_template_visible_departments (process_template_id, department_id)
  SELECT pt_id, v_dept_rh FROM unnest(ARRAY[
    '11111111-1111-4111-8111-111111111601','11111111-1111-4111-8111-111111111602',
    '11111111-1111-4111-8111-111111111603','11111111-1111-4111-8111-111111111604'
  ]::uuid[]) AS pt_id
  ON CONFLICT DO NOTHING;

  -- ── Sub-process templates (un par service cible et par prestation) ──
  INSERT INTO sub_process_templates (id, process_template_id, name, assignment_type, target_department_id, dispatch_manager_id, order_index, is_mandatory, visibility_level, user_id)
  VALUES
    -- ONBOARDING (1601)
    ('22222222-2222-4222-8222-222222221601', '11111111-1111-4111-8111-111111111601', 'Digital — Comptes & accès',      'manager_dispatch', v_dept_it,     v_audrey, 0, true, 'public', v_user_id),
    ('22222222-2222-4222-8222-222222221602', '11111111-1111-4111-8111-111111111601', 'RH — Dossier salarié',           'manager_dispatch', v_dept_rh,     v_audrey, 1, true, 'public', v_user_id),
    ('22222222-2222-4222-8222-222222221603', '11111111-1111-4111-8111-111111111601', 'Services Généraux — Matériel',   'manager_dispatch', v_dept_sg,     v_audrey, 2, true, 'public', v_user_id),
    ('22222222-2222-4222-8222-222222221604', '11111111-1111-4111-8111-111111111601', 'Comm — Identité',                'manager_dispatch', v_dept_comm,   v_audrey, 3, true, 'public', v_user_id),
    ('22222222-2222-4222-8222-222222221605', '11111111-1111-4111-8111-111111111601', 'Digital — Applications métier',  'manager_dispatch', v_dept_it,     v_audrey, 4, true, 'public', v_user_id),
    ('22222222-2222-4222-8222-222222221606', '11111111-1111-4111-8111-111111111601', 'Réglementaire — Formation',      'manager_dispatch', v_dept_regl,   v_audrey, 5, true, 'public', v_user_id),
    ('22222222-2222-4222-8222-222222221607', '11111111-1111-4111-8111-111111111601', 'Comptabilité — Comptes',         'manager_dispatch', v_dept_compta, v_audrey, 6, true, 'public', v_user_id),
    -- OFFBOARDING (1602)
    ('22222222-2222-4222-8222-222222221611', '11111111-1111-4111-8111-111111111602', 'RH — Clôture dossier',           'manager_dispatch', v_dept_rh,     v_audrey, 0, true, 'public', v_user_id),
    ('22222222-2222-4222-8222-222222221612', '11111111-1111-4111-8111-111111111602', 'Digital — Comptes & accès',      'manager_dispatch', v_dept_it,     v_audrey, 1, true, 'public', v_user_id),
    ('22222222-2222-4222-8222-222222221613', '11111111-1111-4111-8111-111111111602', 'Services Généraux — Matériel',   'manager_dispatch', v_dept_sg,     v_audrey, 2, true, 'public', v_user_id),
    ('22222222-2222-4222-8222-222222221614', '11111111-1111-4111-8111-111111111602', 'Digital — Applications métier',  'manager_dispatch', v_dept_it,     v_audrey, 3, true, 'public', v_user_id),
    ('22222222-2222-4222-8222-222222221615', '11111111-1111-4111-8111-111111111602', 'Comptabilité — Comptes',         'manager_dispatch', v_dept_compta, v_audrey, 4, true, 'public', v_user_id),
    -- MUTATION (1603)
    ('22222222-2222-4222-8222-222222221621', '11111111-1111-4111-8111-111111111603', 'RH — Avenant & paie',            'manager_dispatch', v_dept_rh,     v_audrey, 0, true, 'public', v_user_id),
    ('22222222-2222-4222-8222-222222221622', '11111111-1111-4111-8111-111111111603', 'Digital — Comptes & accès',      'manager_dispatch', v_dept_it,     v_audrey, 1, true, 'public', v_user_id),
    ('22222222-2222-4222-8222-222222221623', '11111111-1111-4111-8111-111111111603', 'Comptabilité — Comptes',         'manager_dispatch', v_dept_compta, v_audrey, 2, true, 'public', v_user_id),
    ('22222222-2222-4222-8222-222222221624', '11111111-1111-4111-8111-111111111603', 'Services Généraux — Matériel',   'manager_dispatch', v_dept_sg,     v_audrey, 3, true, 'public', v_user_id),
    -- PROMOTION (1604)
    ('22222222-2222-4222-8222-222222221631', '11111111-1111-4111-8111-111111111604', 'RH — Avenant & paie',            'manager_dispatch', v_dept_rh,     v_audrey, 0, true, 'public', v_user_id),
    ('22222222-2222-4222-8222-222222221632', '11111111-1111-4111-8111-111111111604', 'Digital — Comptes & accès',      'manager_dispatch', v_dept_it,     v_audrey, 1, true, 'public', v_user_id)
  ON CONFLICT (id) DO NOTHING;

  -- ── Task templates (1 par sous-tâche du CDC, validateur N1 = Audrey) ──
  -- Insert idempotent : NOT EXISTS sur (sub_process_template_id, title).
  CREATE TEMP TABLE _rh_tt (sp_id uuid, ord int, title text) ON COMMIT DROP;
  INSERT INTO _rh_tt VALUES
    -- ONBOARDING / Digital — Comptes & accès
    ('22222222-2222-4222-8222-222222221601', 0,  'Appliquer droits réseaux'),
    ('22222222-2222-4222-8222-222222221601', 1,  'Info SPV si besoin'),
    ('22222222-2222-4222-8222-222222221601', 2,  'Créer mot de passe Vaultwarden'),
    ('22222222-2222-4222-8222-222222221601', 3,  'Droits AD'),
    ('22222222-2222-4222-8222-222222221601', 4,  'Création utilisateur Divalto + droits'),
    ('22222222-2222-4222-8222-222222221601', 5,  'Compte Mail'),
    ('22222222-2222-4222-8222-222222221601', 6,  'Compte Office'),
    ('22222222-2222-4222-8222-222222221601', 7,  'Compte Scanner'),
    ('22222222-2222-4222-8222-222222221601', 8,  'Dossiers utilisateur réseau P + Commun'),
    ('22222222-2222-4222-8222-222222221601', 9,  'Mise en place MFA'),
    ('22222222-2222-4222-8222-222222221601', 10, 'PC : Acrobat / Divalto / VPN / Office 365 / Teams / OneDrive / Supremo'),
    ('22222222-2222-4222-8222-222222221601', 11, 'Outlook : partage agenda'),
    ('22222222-2222-4222-8222-222222221601', 12, 'Pipedrive : ajouter user sur Entra'),
    -- ONBOARDING / RH — Dossier salarié
    ('22222222-2222-4222-8222-222222221602', 0, 'Contrat de travail'),
    ('22222222-2222-4222-8222-222222221602', 1, 'DPAE'),
    ('22222222-2222-4222-8222-222222221602', 2, 'Fiche SILAE / LUCCA'),
    ('22222222-2222-4222-8222-222222221602', 3, 'Droits AD (côté RH)'),
    ('22222222-2222-4222-8222-222222221602', 4, 'Intégration RH'),
    ('22222222-2222-4222-8222-222222221602', 5, 'Visite médicale'),
    ('22222222-2222-4222-8222-222222221602', 6, 'Formation interne si besoin'),
    -- ONBOARDING / SG — Matériel
    ('22222222-2222-4222-8222-222222221603', 0, 'Téléphone si oui'),
    ('22222222-2222-4222-8222-222222221603', 1, 'Véhicule si oui'),
    ('22222222-2222-4222-8222-222222221603', 2, 'Badge Vinci'),
    ('22222222-2222-4222-8222-222222221603', 3, 'Carte Total'),
    ('22222222-2222-4222-8222-222222221603', 4, 'Clé des locaux'),
    ('22222222-2222-4222-8222-222222221603', 5, 'Préparation attestation de remise matériel'),
    -- ONBOARDING / Comm
    ('22222222-2222-4222-8222-222222221604', 0, 'Créer compte Letsignit'),
    -- ONBOARDING / Digital — Applications métier
    ('22222222-2222-4222-8222-222222221605', 0, 'Circuit ventes (devis, commande, BL) si besoin'),
    ('22222222-2222-4222-8222-222222221605', 1, 'Circuit achats (commande, BL) si besoin'),
    ('22222222-2222-4222-8222-222222221605', 2, 'Logistique si besoin'),
    ('22222222-2222-4222-8222-222222221605', 3, 'Comptabilité (factures, TVA, règlements) si besoin'),
    ('22222222-2222-4222-8222-222222221605', 4, 'Pipedrive : créer utilisateur si besoin'),
    -- ONBOARDING / Réglementaire
    ('22222222-2222-4222-8222-222222221606', 0, 'Formation FMS'),
    -- ONBOARDING / Comptabilité
    ('22222222-2222-4222-8222-222222221607', 0, 'Création compte Yooz'),
    -- OFFBOARDING / RH
    ('22222222-2222-4222-8222-222222221611', 0, 'LAR'),
    ('22222222-2222-4222-8222-222222221611', 1, 'STC'),
    ('22222222-2222-4222-8222-222222221611', 2, 'Clôture LUCCA'),
    ('22222222-2222-4222-8222-222222221611', 3, 'Archives dossier salarié'),
    -- OFFBOARDING / Digital — Comptes & accès
    ('22222222-2222-4222-8222-222222221612', 0, 'Récupérer le PC'),
    ('22222222-2222-4222-8222-222222221612', 1, 'Nettoyer le PC'),
    ('22222222-2222-4222-8222-222222221612', 2, 'Récupérer licence AD360'),
    ('22222222-2222-4222-8222-222222221612', 3, 'Récupérer licence Office'),
    ('22222222-2222-4222-8222-222222221612', 4, 'Désactiver compte + placer dans anciens salariés'),
    ('22222222-2222-4222-8222-222222221612', 5, 'Supprimer utilisateur dans MFA'),
    ('22222222-2222-4222-8222-222222221612', 6, 'Compte Office'),
    ('22222222-2222-4222-8222-222222221612', 7, 'Archiver dossiers utilisateur'),
    ('22222222-2222-4222-8222-222222221612', 8, 'Supprimer droit Yooz'),
    -- OFFBOARDING / SG
    ('22222222-2222-4222-8222-222222221613', 0, 'Récupérer matériel'),
    -- OFFBOARDING / Digital — Applications métier
    ('22222222-2222-4222-8222-222222221614', 0, 'Divalto : fermer profil'),
    ('22222222-2222-4222-8222-222222221614', 1, 'Pipedrive : fermer profil'),
    -- OFFBOARDING / Comptabilité
    ('22222222-2222-4222-8222-222222221615', 0, 'Récupérer avance permanente'),
    ('22222222-2222-4222-8222-222222221615', 1, 'Fermeture compte Yooz'),
    -- MUTATION / RH
    ('22222222-2222-4222-8222-222222221621', 0, 'Avenant au contrat'),
    ('22222222-2222-4222-8222-222222221621', 1, 'Mise à jour LUCCA'),
    -- MUTATION / Digital
    ('22222222-2222-4222-8222-222222221622', 0, 'Créer alias nouvelle société'),
    ('22222222-2222-4222-8222-222222221622', 1, 'Mettre à jour droits Divalto si nécessaire'),
    -- MUTATION / Comptabilité
    ('22222222-2222-4222-8222-222222221623', 0, 'Avance frais permanente'),
    ('22222222-2222-4222-8222-222222221623', 1, 'Bilan NDF'),
    ('22222222-2222-4222-8222-222222221623', 2, 'Bilan CP'),
    ('22222222-2222-4222-8222-222222221623', 3, 'Modification compte Yooz'),
    -- MUTATION / SG
    ('22222222-2222-4222-8222-222222221624', 0, 'Cartes carburant'),
    ('22222222-2222-4222-8222-222222221624', 1, 'Badge péage'),
    -- PROMOTION / RH
    ('22222222-2222-4222-8222-222222221631', 0, 'Avenant au contrat'),
    ('22222222-2222-4222-8222-222222221631', 1, 'Mise à jour LUCCA'),
    -- PROMOTION / Digital
    ('22222222-2222-4222-8222-222222221632', 0, 'Mettre à jour droits Divalto si nécessaire');

  INSERT INTO task_templates (
    sub_process_template_id, process_template_id, title, priority,
    order_index, start_mode, validation_level_1, validator_level_1_id,
    validation_level_2, visibility_level, user_id
  )
  SELECT
    t.sp_id, s.process_template_id, t.title, 'medium',
    t.ord, 'parallel', 'free', v_audrey,
    'none', 'public'::template_visibility, v_user_id
  FROM _rh_tt t
  JOIN sub_process_templates s ON s.id = t.sp_id
  WHERE NOT EXISTS (
    SELECT 1 FROM task_templates x
    WHERE x.sub_process_template_id = t.sp_id AND x.title = t.title
  );
END $$;
