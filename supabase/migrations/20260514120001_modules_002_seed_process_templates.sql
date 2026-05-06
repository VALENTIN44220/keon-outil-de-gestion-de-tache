-- ============================================================
-- MODULES 002 — Seed des process_templates par module
-- ============================================================
-- Cree les process_templates de chaque module sur la base des CDC
-- (docs/CDC/CDC_MODULES.xlsx).
--
-- Convention UUID : 11111111-1111-4111-8111-111111111XYZ avec XYZ
-- numerote par module (101+ Maintenance, 201+ Log, etc.).
--
-- user_id : on reutilise un user_id existant (premier admin trouve).
-- Champs obligatoires : name, user_id, is_shared, visibility_level,
-- recurrence_enabled.
-- ============================================================

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.process_templates
  WHERE user_id IS NOT NULL
  LIMIT 1;

  IF v_user_id IS NULL THEN
    SELECT user_id INTO v_user_id FROM public.profiles LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Impossible de trouver un user_id valide pour seedeer les process_templates';
  END IF;

  INSERT INTO public.process_templates (
    id, name, description, user_id, is_shared, visibility_level, recurrence_enabled, created_at, updated_at
  )
  VALUES
    -- Maintenance
    ('11111111-1111-4111-8111-111111111101', 'Maintenance - Demande de materiel', 'Demande d articles soumise a validation du coordinateur', v_user_id, true, 'public', false, now(), now()),
    -- Logistique
    ('11111111-1111-4111-8111-111111111201', 'Logistique - Demande de transport', 'Transport courant ou urgent (flag URGENCE)', v_user_id, true, 'public', false, now(), now()),
    -- IT (7)
    ('11111111-1111-4111-8111-111111111301', 'IT - Ouverture dossier SharePoint', 'Demande de creation d un dossier SharePoint', v_user_id, true, 'public', false, now(), now()),
    ('11111111-1111-4111-8111-111111111302', 'IT - Support Divalto', 'Support fonctionnel Divalto', v_user_id, true, 'public', false, now(), now()),
    ('11111111-1111-4111-8111-111111111303', 'IT - Support Pipedrive', 'Support fonctionnel Pipedrive', v_user_id, true, 'public', false, now(), now()),
    ('11111111-1111-4111-8111-111111111304', 'IT - Support Lucca', 'Support fonctionnel Lucca', v_user_id, true, 'public', false, now(), now()),
    ('11111111-1111-4111-8111-111111111305', 'IT - Reporting Power BI', 'Demande de tableau de bord Power BI', v_user_id, true, 'public', false, now(), now()),
    ('11111111-1111-4111-8111-111111111306', 'IT - Demande d intervention IT', 'Intervention IT generique', v_user_id, true, 'public', false, now(), now()),
    ('11111111-1111-4111-8111-111111111307', 'IT - Support materiel bureautique', 'Support PC / peripherique / poste', v_user_id, true, 'public', false, now(), now()),
    -- Comm (2)
    ('11111111-1111-4111-8111-111111111401', 'Comm - Demande communication marketing', 'Demande generique creation com', v_user_id, true, 'public', false, now(), now()),
    ('11111111-1111-4111-8111-111111111402', 'Comm - Reservation stand nomade', 'Reservation et logistique stand salon', v_user_id, true, 'public', false, now(), now()),
    -- Innovation (2)
    ('11111111-1111-4111-8111-111111111501', 'Innovation - Nouvelle demande', 'Idee/projet a instruire (arbitrage CODIR)', v_user_id, true, 'public', false, now(), now()),
    ('11111111-1111-4111-8111-111111111502', 'Innovation - MAJ avancement projet', 'Mise a jour de l avancement', v_user_id, true, 'public', false, now(), now()),
    -- RH (4)
    ('11111111-1111-4111-8111-111111111601', 'RH - Onboarding', 'Arrivee nouveau collaborateur', v_user_id, true, 'public', false, now(), now()),
    ('11111111-1111-4111-8111-111111111602', 'RH - Offboarding', 'Depart collaborateur', v_user_id, true, 'public', false, now(), now()),
    ('11111111-1111-4111-8111-111111111603', 'RH - Mutation', 'Changement societe/poste/manager', v_user_id, true, 'public', false, now(), now()),
    ('11111111-1111-4111-8111-111111111604', 'RH - Promotion', 'Evolution de poste', v_user_id, true, 'public', false, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at = now();
END $$;
