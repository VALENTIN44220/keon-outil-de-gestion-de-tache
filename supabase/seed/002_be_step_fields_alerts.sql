-- ============================================================
-- SEED 002 : Alertes temporelles par étape (ICPE + PC)
-- ============================================================
-- À exécuter APRÈS le seed 001.
-- Les alertes sont attachées aux étapes via sub_process_step_fields.
-- Utilise les noms des étapes pour retrouver les IDs.
-- ============================================================

DO $$
DECLARE
  v_be_process_id UUID := 'bd75a3b0-c918-4b43-befe-739b83f7461a';
  v_step_id UUID;
BEGIN

  -- ──────────────────────────────────────────────────────────
  -- ICPE DÉCLARATION
  -- ──────────────────────────────────────────────────────────

  -- Dépôt → alerte enregistrement date dépôt + alerte 15j
  SELECT id INTO v_step_id FROM sub_process_templates
  WHERE process_template_id = v_be_process_id
    AND name = 'ICPE Déclaration — Dépôt dossier';

  IF v_step_id IS NOT NULL THEN
    INSERT INTO sub_process_step_fields
      (sub_process_template_id, field_key, field_label, field_type, is_required,
       alert_enabled, alert_delay_days, alert_message, alert_target, order_index)
    VALUES
    (v_step_id, 'date_depot', 'Date de dépôt', 'date', true,
     true, 15, 'Alerte 15 jours après le dépôt — vérifier le retour', 'dispatcher', 1),
    (v_step_id, 'lien_dossier_depose', 'Lien vers le dossier déposé', 'url', false,
     false, NULL, NULL, NULL, 2)
    ON CONFLICT (sub_process_template_id, field_key) DO NOTHING;
  END IF;

  -- Publication preuve de dépôt → alerte 2 mois après
  SELECT id INTO v_step_id FROM sub_process_templates
  WHERE process_template_id = v_be_process_id
    AND name = 'ICPE Déclaration — Publication preuve de dépôt';

  IF v_step_id IS NOT NULL THEN
    INSERT INTO sub_process_step_fields
      (sub_process_template_id, field_key, field_label, field_type, is_required,
       alert_enabled, alert_delay_days, alert_message, alert_target, order_index)
    VALUES
    (v_step_id, 'date_publication', 'Date de publication preuve de dépôt', 'date', true,
     true, 60, 'Alerte 2 mois après publication — vérifier complétude', 'dispatcher', 1),
    (v_step_id, 'lien_preuve_depot', 'Lien vers la preuve de dépôt', 'url', false,
     false, NULL, NULL, NULL, 2)
    ON CONFLICT (sub_process_template_id, field_key) DO NOTHING;
  END IF;

  -- ──────────────────────────────────────────────────────────
  -- ICPE ENREGISTREMENT
  -- ──────────────────────────────────────────────────────────

  -- Dépôt dossier + Récépissé
  SELECT id INTO v_step_id FROM sub_process_templates
  WHERE process_template_id = v_be_process_id
    AND name = 'ICPE Enregistrement — Dépôt dossier + Récépissé';

  IF v_step_id IS NOT NULL THEN
    INSERT INTO sub_process_step_fields
      (sub_process_template_id, field_key, field_label, field_type, is_required,
       alert_enabled, alert_delay_days, alert_message, alert_target, order_index)
    VALUES
    (v_step_id, 'date_recepisse', 'Date du récépissé', 'date', true,
     false, NULL, NULL, NULL, 1),
    (v_step_id, 'lien_preuve_depot', 'Lien vers la preuve de dépôt', 'url', false,
     false, NULL, NULL, NULL, 2),
    (v_step_id, 'lien_dossier_depose', 'Lien vers le dossier déposé', 'url', false,
     false, NULL, NULL, NULL, 3)
    ON CONFLICT (sub_process_template_id, field_key) DO NOTHING;
  END IF;

  -- Complétude obtenue → alerte 3 mois après consultation publique
  SELECT id INTO v_step_id FROM sub_process_templates
  WHERE process_template_id = v_be_process_id
    AND name = 'ICPE Enregistrement — Complétude obtenue';

  IF v_step_id IS NOT NULL THEN
    INSERT INTO sub_process_step_fields
      (sub_process_template_id, field_key, field_label, field_type, is_required,
       alert_enabled, alert_delay_days, alert_message, alert_target, order_index)
    VALUES
    (v_step_id, 'date_completude', 'Date de complétude', 'date', true,
     true, 90, 'Alerte 3 mois après complétude — suivi consultation publique', 'dispatcher', 1)
    ON CONFLICT (sub_process_template_id, field_key) DO NOTHING;
  END IF;

  -- Obtention de l'arrêté → alerte 5 mois après complétude
  SELECT id INTO v_step_id FROM sub_process_templates
  WHERE process_template_id = v_be_process_id
    AND name = 'ICPE Enregistrement — Obtention de l''arrêté';

  IF v_step_id IS NOT NULL THEN
    INSERT INTO sub_process_step_fields
      (sub_process_template_id, field_key, field_label, field_type, is_required,
       alert_enabled, alert_delay_days, alert_message, alert_target, order_index)
    VALUES
    (v_step_id, 'date_arrete', 'Date de l''arrêté', 'date', true,
     true, 60, 'Alerte 2 mois après réception de l''arrêté', 'dispatcher', 1),
    (v_step_id, 'lien_arrete', 'Lien vers l''arrêté', 'url', false,
     false, NULL, NULL, NULL, 2)
    ON CONFLICT (sub_process_template_id, field_key) DO NOTHING;
  END IF;

  -- ──────────────────────────────────────────────────────────
  -- PERMIS DE CONSTRUIRE
  -- ──────────────────────────────────────────────────────────

  -- Réalisation plan PC → lien plan validé
  SELECT id INTO v_step_id FROM sub_process_templates
  WHERE process_template_id = v_be_process_id
    AND name = 'Permis de construire — Réalisation plan PC';

  IF v_step_id IS NOT NULL THEN
    INSERT INTO sub_process_step_fields
      (sub_process_template_id, field_key, field_label, field_type, is_required,
       alert_enabled, alert_delay_days, alert_message, alert_target, order_index)
    VALUES
    (v_step_id, 'lien_plan_valide', 'Lien vers le plan validé', 'url', false,
     false, NULL, NULL, NULL, 1)
    ON CONFLICT (sub_process_template_id, field_key) DO NOTHING;
  END IF;

  -- Dépôt → lien dossier déposé
  SELECT id INTO v_step_id FROM sub_process_templates
  WHERE process_template_id = v_be_process_id
    AND name = 'Permis de construire — Dépôt';

  IF v_step_id IS NOT NULL THEN
    INSERT INTO sub_process_step_fields
      (sub_process_template_id, field_key, field_label, field_type, is_required,
       alert_enabled, alert_delay_days, alert_message, alert_target, order_index)
    VALUES
    (v_step_id, 'date_depot', 'Date de dépôt', 'date', true,
     false, NULL, NULL, NULL, 1),
    (v_step_id, 'lien_dossier_depose', 'Lien vers le dossier déposé', 'url', false,
     false, NULL, NULL, NULL, 2)
    ON CONFLICT (sub_process_template_id, field_key) DO NOTHING;
  END IF;

  -- Arrêté de PC → alerte 4 mois après complétude + 2 mois après affichage
  SELECT id INTO v_step_id FROM sub_process_templates
  WHERE process_template_id = v_be_process_id
    AND name = 'Permis de construire — Arrêté de PC';

  IF v_step_id IS NOT NULL THEN
    INSERT INTO sub_process_step_fields
      (sub_process_template_id, field_key, field_label, field_type, is_required,
       alert_enabled, alert_delay_days, alert_message, alert_target, order_index)
    VALUES
    (v_step_id, 'date_completude', 'Date de complétude', 'date', true,
     true, 120, 'Alerte 4 mois après complétude', 'dispatcher', 1),
    (v_step_id, 'lien_rc', 'Lien vers le dossier complet et courrier complétude', 'url', false,
     false, NULL, NULL, NULL, 2)
    ON CONFLICT (sub_process_template_id, field_key) DO NOTHING;
  END IF;

  -- Affichage → alerte au moment de l'obtention + 2 mois après
  SELECT id INTO v_step_id FROM sub_process_templates
  WHERE process_template_id = v_be_process_id
    AND name = 'Permis de construire — Affichage';

  IF v_step_id IS NOT NULL THEN
    INSERT INTO sub_process_step_fields
      (sub_process_template_id, field_key, field_label, field_type, is_required,
       alert_enabled, alert_delay_days, alert_message, alert_target, order_index)
    VALUES
    (v_step_id, 'date_affichage', 'Date d''affichage', 'date', true,
     true, 60, 'Alerte 2 mois après affichage — suivi purge', 'dispatcher', 1)
    ON CONFLICT (sub_process_template_id, field_key) DO NOTHING;
  END IF;

  -- ──────────────────────────────────────────────────────────
  -- OFFRES COMMERCIALES
  -- ──────────────────────────────────────────────────────────

  SELECT id INTO v_step_id FROM sub_process_templates
  WHERE process_template_id = v_be_process_id
    AND name = 'Offres commerciales — Revue de conception';

  IF v_step_id IS NOT NULL THEN
    INSERT INTO sub_process_step_fields
      (sub_process_template_id, field_key, field_label, field_type, is_required,
       alert_enabled, alert_delay_days, alert_message, alert_target, order_index)
    VALUES
    (v_step_id, 'lien_docs_valides', 'Lien vers les docs validés', 'url', false,
     false, NULL, NULL, NULL, 1)
    ON CONFLICT (sub_process_template_id, field_key) DO NOTHING;
  END IF;

END $$;
