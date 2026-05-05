-- ============================================================
-- SEED 003 : Prestations BE v3 — complète la liste cible (20)
-- ============================================================
-- Objectifs :
--  1. Renommer « Dimensionnement hors offre » → « Dimensionnement et
--     chiffrage hors offre » (libellé cible).
--  2. Ajouter 4 prestations manquantes — pattern « Autres études »
--     (3 étapes : Réalisation / Validation / Envoi) :
--       - Raccordement
--       - MOE AVP
--       - MOE PRO
--       - Maîtrise d'Œuvre Exécution
--
-- Idempotent : UPDATEs sans condition + INSERT avec UUIDs fixes
-- (`be000002-…`) + ON CONFLICT (id) DO NOTHING.
-- ============================================================

DO $$
DECLARE
  v_be_process_id UUID := 'bd75a3b0-c918-4b43-befe-739b83f7461a';
  v_marion_id     UUID := '23c7a2c7-14aa-48cf-9dd0-c06c91f5c947'; -- PAVAT Marion
BEGIN

  -- ──────────────────────────────────────────────────────────
  -- 1. Renommage : "Dimensionnement hors offre" → "Dimensionnement et chiffrage hors offre"
  -- ──────────────────────────────────────────────────────────
  UPDATE sub_process_templates
  SET name = 'Dimensionnement et chiffrage hors offre — '
           || SUBSTRING(name FROM 30)  -- 30 = length('Dimensionnement hors offre — ') + 1
  WHERE process_template_id = v_be_process_id
    AND name LIKE 'Dimensionnement hors offre — %';

  -- ──────────────────────────────────────────────────────────
  -- 2. Ajout des 4 prestations manquantes
  --    Catégorie : 'be' (dispatcher Marion). Pattern Autres études.
  -- ──────────────────────────────────────────────────────────
  INSERT INTO sub_process_templates (
    id, process_template_id, name, be_category,
    assignment_type, dispatch_manager_id,
    validation_level_1_type, validation_level_1_user_id,
    validation_level_2_type,
    is_mandatory, order_index, is_shared
  ) VALUES
  -- Raccordement (3 étapes)
  ('be000002-0000-0000-0000-000000000201'::uuid, v_be_process_id,
    'Raccordement — Réalisation', 'be', 'manager_dispatch', v_marion_id,
    'fixed_user', v_marion_id, NULL, true, 200, true),
  ('be000002-0000-0000-0000-000000000202'::uuid, v_be_process_id,
    'Raccordement — Validation', 'be', 'manager_dispatch', v_marion_id,
    'fixed_user', v_marion_id, NULL, true, 201, true),
  ('be000002-0000-0000-0000-000000000203'::uuid, v_be_process_id,
    'Raccordement — Envoi', 'be', 'manager_dispatch', v_marion_id,
    'fixed_user', v_marion_id, NULL, true, 202, true),

  -- MOE AVP (3 étapes)
  ('be000002-0000-0000-0000-000000000211'::uuid, v_be_process_id,
    'MOE AVP — Réalisation', 'be', 'manager_dispatch', v_marion_id,
    'fixed_user', v_marion_id, NULL, true, 210, true),
  ('be000002-0000-0000-0000-000000000212'::uuid, v_be_process_id,
    'MOE AVP — Validation', 'be', 'manager_dispatch', v_marion_id,
    'fixed_user', v_marion_id, NULL, true, 211, true),
  ('be000002-0000-0000-0000-000000000213'::uuid, v_be_process_id,
    'MOE AVP — Envoi', 'be', 'manager_dispatch', v_marion_id,
    'fixed_user', v_marion_id, NULL, true, 212, true),

  -- MOE PRO (3 étapes)
  ('be000002-0000-0000-0000-000000000221'::uuid, v_be_process_id,
    'MOE PRO — Réalisation', 'be', 'manager_dispatch', v_marion_id,
    'fixed_user', v_marion_id, NULL, true, 220, true),
  ('be000002-0000-0000-0000-000000000222'::uuid, v_be_process_id,
    'MOE PRO — Validation', 'be', 'manager_dispatch', v_marion_id,
    'fixed_user', v_marion_id, NULL, true, 221, true),
  ('be000002-0000-0000-0000-000000000223'::uuid, v_be_process_id,
    'MOE PRO — Envoi', 'be', 'manager_dispatch', v_marion_id,
    'fixed_user', v_marion_id, NULL, true, 222, true),

  -- Maîtrise d'Œuvre Exécution (3 étapes)
  ('be000002-0000-0000-0000-000000000231'::uuid, v_be_process_id,
    'Maîtrise d''Œuvre Exécution — Réalisation', 'be', 'manager_dispatch', v_marion_id,
    'fixed_user', v_marion_id, NULL, true, 230, true),
  ('be000002-0000-0000-0000-000000000232'::uuid, v_be_process_id,
    'Maîtrise d''Œuvre Exécution — Validation', 'be', 'manager_dispatch', v_marion_id,
    'fixed_user', v_marion_id, NULL, true, 231, true),
  ('be000002-0000-0000-0000-000000000233'::uuid, v_be_process_id,
    'Maîtrise d''Œuvre Exécution — Envoi', 'be', 'manager_dispatch', v_marion_id,
    'fixed_user', v_marion_id, NULL, true, 232, true)
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Seed 003 (BE prestations v3) appliqué : 4 prestations ajoutées + 1 renommée';
END $$;
