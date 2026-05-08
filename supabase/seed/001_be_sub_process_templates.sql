-- ============================================================
-- SEED 001 : Sub-process templates BE — 18 prestations
-- ============================================================
-- Remplacer les placeholders avant exécution (voir CLAUDE.md)
-- Idempotent : INSERT ... ON CONFLICT DO NOTHING
-- ============================================================

-- Variables (remplacer par les vrais UUIDs)
DO $$
DECLARE
  v_be_process_id       UUID := 'bd75a3b0-c918-4b43-befe-739b83f7461a';
  v_florence_id         UUID := '17e506f2-8b1e-46e5-8641-84de7025c999'; -- MARTIN SISTERON Florence
  v_marion_id           UUID := '23c7a2c7-14aa-48cf-9dd0-c06c91f5c947'; -- PAVAT Marion
  v_guillaume_id        UUID := '4e4254bd-fd71-4933-a314-96826ce0a968'; -- MORICEAU Guillaume (Projeteur)
  v_germain_id          UUID := '58e64899-0f72-4cd1-a553-f45ebdb1a771'; -- L'HERIAU Germain

  -- UUIDs fixes pour chaque prestation (stable = idempotent)
  v_icpe_decl           UUID := 'be000001-0000-0000-0000-000000000001';
  v_icpe_enreg          UUID := 'be000001-0000-0000-0000-000000000002';
  v_icpe_autor          UUID := 'be000001-0000-0000-0000-000000000003';
  v_pc                  UUID := 'be000001-0000-0000-0000-000000000004';
  v_agr_san             UUID := 'be000001-0000-0000-0000-000000000005';
  v_pac                 UUID := 'be000001-0000-0000-0000-000000000006';
  v_odeurs              UUID := 'be000001-0000-0000-0000-000000000007';
  v_acoustique          UUID := 'be000001-0000-0000-0000-000000000008';
  v_faune_flore         UUID := 'be000001-0000-0000-0000-000000000009';
  v_plan_regl           UUID := 'be000001-0000-0000-0000-000000000010';
  v_offres_com          UUID := 'be000001-0000-0000-0000-000000000011';
  v_dim_hors_offre      UUID := 'be000001-0000-0000-0000-000000000012';
  v_terrain             UUID := 'be000001-0000-0000-0000-000000000013';
  v_photovoltaique      UUID := 'be000001-0000-0000-0000-000000000014';
  v_co2                 UUID := 'be000001-0000-0000-0000-000000000015';
  v_audit_process       UUID := 'be000001-0000-0000-0000-000000000016';
  v_subvention          UUID := 'be000001-0000-0000-0000-000000000017';
  v_autre_etude         UUID := 'be000001-0000-0000-0000-000000000018';

BEGIN

  -- ──────────────────────────────────────────────────────────
  -- PRESTATIONS RÉGLEMENTAIRES (dispatcher: Florence)
  -- ──────────────────────────────────────────────────────────

  -- 1. ICPE DÉCLARATION (6 étapes)
  INSERT INTO sub_process_templates (
    id, process_template_id, name, be_category,
    assignment_type, dispatch_manager_id,
    validation_level_1_type, validation_level_1_user_id,
    validation_level_2_type,
    is_mandatory, order_index, is_shared
  ) VALUES
  -- Étape 1 : Réalisation du dossier
  (gen_random_uuid(), v_be_process_id, 'ICPE Déclaration — Réalisation du dossier',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, 'requester',
   true, 10, true),
  -- Étape 2 : Réalisation des plans
  (gen_random_uuid(), v_be_process_id, 'ICPE Déclaration — Réalisation des plans',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL,
   true, 11, true),
  -- Étape 3 : Dépôt dossier + Preuve de dépôt
  (gen_random_uuid(), v_be_process_id, 'ICPE Déclaration — Dépôt dossier',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL,
   true, 12, true),
  -- Étape 4 : Publication de la preuve de dépôt sur site
  (gen_random_uuid(), v_be_process_id, 'ICPE Déclaration — Publication preuve de dépôt',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL,
   true, 13, true),
  -- Étape 5 : Complétude obtenue
  (gen_random_uuid(), v_be_process_id, 'ICPE Déclaration — Complétude obtenue',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL,
   true, 14, true),
  -- Étape 6 : Purge
  (gen_random_uuid(), v_be_process_id, 'ICPE Déclaration — Purge',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL,
   true, 15, true)
  ON CONFLICT (id) DO NOTHING;

  -- 2. ICPE ENREGISTREMENT (11 étapes)
  INSERT INTO sub_process_templates (
    id, process_template_id, name, be_category,
    assignment_type, dispatch_manager_id,
    validation_level_1_type, validation_level_1_user_id,
    validation_level_2_type,
    is_mandatory, order_index, is_shared
  ) VALUES
  (gen_random_uuid(), v_be_process_id, 'ICPE Enregistrement — Réalisation du dossier',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, 'requester', true, 20, true),
  (gen_random_uuid(), v_be_process_id, 'ICPE Enregistrement — Réalisation des plans',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 21, true),
  (gen_random_uuid(), v_be_process_id, 'ICPE Enregistrement — Dépôt dossier + Récépissé',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 22, true),
  (gen_random_uuid(), v_be_process_id, 'ICPE Enregistrement — Affichage panneau ICPE sur parcelle',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 23, true),
  (gen_random_uuid(), v_be_process_id, 'ICPE Enregistrement — Demande de compléments',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, false, 24, true),
  (gen_random_uuid(), v_be_process_id, 'ICPE Enregistrement — Dépôt des compléments',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, false, 25, true),
  (gen_random_uuid(), v_be_process_id, 'ICPE Enregistrement — Complétude obtenue',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 26, true),
  (gen_random_uuid(), v_be_process_id, 'ICPE Enregistrement — Arrêté de la consultation du public',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 27, true),
  (gen_random_uuid(), v_be_process_id, 'ICPE Enregistrement — Lecture du projet d''arrêté',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 28, true),
  (gen_random_uuid(), v_be_process_id, 'ICPE Enregistrement — Passage CODERST',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 29, true),
  (gen_random_uuid(), v_be_process_id, 'ICPE Enregistrement — Obtention de l''arrêté',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 30, true)
  ON CONFLICT (id) DO NOTHING;

  -- 3. ICPE AUTORISATION (pattern "autre étude" étendu)
  INSERT INTO sub_process_templates (
    id, process_template_id, name, be_category,
    assignment_type, dispatch_manager_id,
    validation_level_1_type, validation_level_1_user_id,
    validation_level_2_type,
    is_mandatory, order_index, is_shared
  ) VALUES
  (gen_random_uuid(), v_be_process_id, 'ICPE Autorisation — Réalisation',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, 'requester', true, 40, true),
  (gen_random_uuid(), v_be_process_id, 'ICPE Autorisation — Validation',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 41, true),
  (gen_random_uuid(), v_be_process_id, 'ICPE Autorisation — Envoi',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 42, true)
  ON CONFLICT (id) DO NOTHING;

  -- 4. PERMIS DE CONSTRUIRE (9 étapes)
  INSERT INTO sub_process_templates (
    id, process_template_id, name, be_category,
    assignment_type, dispatch_manager_id,
    validation_level_1_type, validation_level_1_user_id,
    validation_level_2_type,
    is_mandatory, order_index, is_shared
  ) VALUES
  (gen_random_uuid(), v_be_process_id, 'Permis de construire — Réalisation plan PC',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, 'requester', true, 50, true),
  (gen_random_uuid(), v_be_process_id, 'Permis de construire — Réalisation dossier',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 51, true),
  (gen_random_uuid(), v_be_process_id, 'Permis de construire — Dépôt',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 52, true),
  (gen_random_uuid(), v_be_process_id, 'Permis de construire — Demande de compléments',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, false, 53, true),
  (gen_random_uuid(), v_be_process_id, 'Permis de construire — Dépôt des compléments',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, false, 54, true),
  (gen_random_uuid(), v_be_process_id, 'Permis de construire — Complétude obtenue',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 55, true),
  (gen_random_uuid(), v_be_process_id, 'Permis de construire — Arrêté de PC',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 56, true),
  (gen_random_uuid(), v_be_process_id, 'Permis de construire — Affichage',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 57, true),
  (gen_random_uuid(), v_be_process_id, 'Permis de construire — Purge',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 58, true)
  ON CONFLICT (id) DO NOTHING;

  -- 5. AGRÉMENT SANITAIRE (9 étapes)
  INSERT INTO sub_process_templates (
    id, process_template_id, name, be_category,
    assignment_type, dispatch_manager_id,
    validation_level_1_type, validation_level_1_user_id,
    validation_level_2_type,
    is_mandatory, order_index, is_shared
  ) VALUES
  (gen_random_uuid(), v_be_process_id, 'Agrément sanitaire — Réalisation du dossier',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, 'requester', true, 60, true),
  (gen_random_uuid(), v_be_process_id, 'Agrément sanitaire — Réalisation des plans',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 61, true),
  (gen_random_uuid(), v_be_process_id, 'Agrément sanitaire — Dépôt',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 62, true),
  (gen_random_uuid(), v_be_process_id, 'Agrément sanitaire — Demande de compléments',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, false, 63, true),
  (gen_random_uuid(), v_be_process_id, 'Agrément sanitaire — Dépôt des compléments',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, false, 64, true),
  (gen_random_uuid(), v_be_process_id, 'Agrément sanitaire — Visite de l''administration',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 65, true),
  (gen_random_uuid(), v_be_process_id, 'Agrément sanitaire — Agrément provisoire',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 66, true),
  (gen_random_uuid(), v_be_process_id, 'Agrément sanitaire — 2ème visite',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, false, 67, true),
  (gen_random_uuid(), v_be_process_id, 'Agrément sanitaire — Agrément définitif',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 68, true)
  ON CONFLICT (id) DO NOTHING;

  -- 6-10. PRESTATIONS RÉGLEMENTAIRES PATTERN "AUTRE ÉTUDE" (Florence)
  INSERT INTO sub_process_templates (
    id, process_template_id, name, be_category,
    assignment_type, dispatch_manager_id,
    validation_level_1_type, validation_level_1_user_id,
    validation_level_2_type,
    is_mandatory, order_index, is_shared
  ) VALUES
  -- Plan d'Assurance Construction
  (gen_random_uuid(), v_be_process_id, 'Plan d''Assurance Construction — Réalisation',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, 'requester', true, 70, true),
  (gen_random_uuid(), v_be_process_id, 'Plan d''Assurance Construction — Validation',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 71, true),
  (gen_random_uuid(), v_be_process_id, 'Plan d''Assurance Construction — Envoi',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 72, true),
  -- Étude des odeurs
  (gen_random_uuid(), v_be_process_id, 'Étude des odeurs — Réalisation',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, 'requester', true, 80, true),
  (gen_random_uuid(), v_be_process_id, 'Étude des odeurs — Validation',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 81, true),
  (gen_random_uuid(), v_be_process_id, 'Étude des odeurs — Envoi',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 82, true),
  -- Étude acoustique
  (gen_random_uuid(), v_be_process_id, 'Étude acoustique — Réalisation',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, 'requester', true, 90, true),
  (gen_random_uuid(), v_be_process_id, 'Étude acoustique — Validation',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 91, true),
  (gen_random_uuid(), v_be_process_id, 'Étude acoustique — Envoi',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 92, true),
  -- Plan règlementaire
  (gen_random_uuid(), v_be_process_id, 'Plan règlementaire — Réalisation',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, 'requester', true, 100, true),
  (gen_random_uuid(), v_be_process_id, 'Plan règlementaire — Validation',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 101, true),
  (gen_random_uuid(), v_be_process_id, 'Plan règlementaire — Envoi',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 102, true),
  -- Étude faune et flore
  (gen_random_uuid(), v_be_process_id, 'Étude faune et flore — Réalisation',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, 'requester', true, 110, true),
  (gen_random_uuid(), v_be_process_id, 'Étude faune et flore — Validation',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 111, true),
  (gen_random_uuid(), v_be_process_id, 'Étude faune et flore — Envoi',
   'be_reglementaire', 'manager_dispatch', v_florence_id,
   'fixed_user', v_florence_id, NULL, true, 112, true)
  ON CONFLICT (id) DO NOTHING;

  -- ──────────────────────────────────────────────────────────
  -- PRESTATIONS BE (dispatcher: Marion)
  -- ──────────────────────────────────────────────────────────

  -- 11. OFFRES COMMERCIALES (4 étapes)
  INSERT INTO sub_process_templates (
    id, process_template_id, name, be_category,
    assignment_type, dispatch_manager_id,
    validation_level_1_type, validation_level_1_user_id,
    validation_level_2_type, validation_level_2_user_id,
    is_mandatory, order_index, is_shared
  ) VALUES
  (gen_random_uuid(), v_be_process_id, 'Offres commerciales — Rédaction offre',
   'be', 'manager_dispatch', v_marion_id,
   'fixed_user', v_marion_id, NULL, NULL,
   true, 120, true),
  (gen_random_uuid(), v_be_process_id, 'Offres commerciales — Revue de conception',
   'be', 'manager_dispatch', v_marion_id,
   'fixed_user', v_marion_id, NULL, NULL,
   true, 121, true),
  (gen_random_uuid(), v_be_process_id, 'Offres commerciales — Validation Word + COGS',
   'be', 'manager_dispatch', v_marion_id,
   'fixed_user', v_marion_id, NULL, NULL,
   true, 122, true),
  (gen_random_uuid(), v_be_process_id, 'Offres commerciales — Validation marge',
   'be', 'manager_dispatch', v_marion_id,
   'fixed_user', v_marion_id, 'fixed_user', v_germain_id,
   true, 123, true)
  ON CONFLICT (id) DO NOTHING;

  -- 12. DIMENSIONNEMENT ET CHIFFRAGE HORS OFFRE (4 étapes)
  INSERT INTO sub_process_templates (
    id, process_template_id, name, be_category,
    assignment_type, dispatch_manager_id,
    validation_level_1_type, validation_level_1_user_id,
    validation_level_2_type, validation_level_2_user_id,
    is_mandatory, order_index, is_shared
  ) VALUES
  (gen_random_uuid(), v_be_process_id, 'Dimensionnement hors offre — Rédaction offre',
   'be', 'manager_dispatch', v_marion_id,
   'fixed_user', v_marion_id, NULL, NULL,
   true, 130, true),
  (gen_random_uuid(), v_be_process_id, 'Dimensionnement hors offre — Revue de conception',
   'be', 'manager_dispatch', v_marion_id,
   'fixed_user', v_marion_id, NULL, NULL,
   true, 131, true),
  (gen_random_uuid(), v_be_process_id, 'Dimensionnement hors offre — Validation Word + COGS',
   'be', 'manager_dispatch', v_marion_id,
   'fixed_user', v_marion_id, NULL, NULL,
   true, 132, true),
  (gen_random_uuid(), v_be_process_id, 'Dimensionnement hors offre — Validation marge',
   'be', 'manager_dispatch', v_marion_id,
   'fixed_user', v_marion_id, 'fixed_user', v_germain_id,
   true, 133, true)
  ON CONFLICT (id) DO NOTHING;

  -- 13-18. PRESTATIONS BE PATTERN "AUTRE ÉTUDE" (Marion)
  INSERT INTO sub_process_templates (
    id, process_template_id, name, be_category,
    assignment_type, dispatch_manager_id,
    validation_level_1_type, validation_level_1_user_id,
    validation_level_2_type,
    is_mandatory, order_index, is_shared
  ) VALUES
  -- Étude de terrain
  (gen_random_uuid(), v_be_process_id, 'Étude de terrain — Réalisation',
   'be', 'manager_dispatch', v_marion_id,
   'fixed_user', v_marion_id, 'requester', true, 140, true),
  (gen_random_uuid(), v_be_process_id, 'Étude de terrain — Validation',
   'be', 'manager_dispatch', v_marion_id,
   'fixed_user', v_marion_id, NULL, true, 141, true),
  (gen_random_uuid(), v_be_process_id, 'Étude de terrain — Envoi',
   'be', 'manager_dispatch', v_marion_id,
   'fixed_user', v_marion_id, NULL, true, 142, true),
  -- Étude photovoltaïque
  (gen_random_uuid(), v_be_process_id, 'Étude photovoltaïque — Réalisation',
   'be', 'manager_dispatch', v_marion_id,
   'fixed_user', v_marion_id, 'requester', true, 150, true),
  (gen_random_uuid(), v_be_process_id, 'Étude photovoltaïque — Validation',
   'be', 'manager_dispatch', v_marion_id,
   'fixed_user', v_marion_id, NULL, true, 151, true),
  (gen_random_uuid(), v_be_process_id, 'Étude photovoltaïque — Envoi',
   'be', 'manager_dispatch', v_marion_id,
   'fixed_user', v_marion_id, NULL, true, 152, true),
  -- Étude CO2
  (gen_random_uuid(), v_be_process_id, 'Étude CO2 — Réalisation',
   'be', 'manager_dispatch', v_marion_id,
   'fixed_user', v_marion_id, 'requester', true, 160, true),
  (gen_random_uuid(), v_be_process_id, 'Étude CO2 — Validation',
   'be', 'manager_dispatch', v_marion_id,
   'fixed_user', v_marion_id, NULL, true, 161, true),
  (gen_random_uuid(), v_be_process_id, 'Étude CO2 — Envoi',
   'be', 'manager_dispatch', v_marion_id,
   'fixed_user', v_marion_id, NULL, true, 162, true),
  -- AUDIT PROCESS
  (gen_random_uuid(), v_be_process_id, 'Audit process — Réalisation',
   'be', 'manager_dispatch', v_marion_id,
   'fixed_user', v_marion_id, 'requester', true, 170, true),
  (gen_random_uuid(), v_be_process_id, 'Audit process — Validation',
   'be', 'manager_dispatch', v_marion_id,
   'fixed_user', v_marion_id, NULL, true, 171, true),
  (gen_random_uuid(), v_be_process_id, 'Audit process — Envoi',
   'be', 'manager_dispatch', v_marion_id,
   'fixed_user', v_marion_id, NULL, true, 172, true),
  -- Dossier de subvention
  (gen_random_uuid(), v_be_process_id, 'Dossier de subvention — Réalisation',
   'be', 'manager_dispatch', v_marion_id,
   'fixed_user', v_marion_id, 'requester', true, 180, true),
  (gen_random_uuid(), v_be_process_id, 'Dossier de subvention — Validation',
   'be', 'manager_dispatch', v_marion_id,
   'fixed_user', v_marion_id, NULL, true, 181, true),
  (gen_random_uuid(), v_be_process_id, 'Dossier de subvention — Envoi',
   'be', 'manager_dispatch', v_marion_id,
   'fixed_user', v_marion_id, NULL, true, 182, true),
  -- Autre étude (générique)
  (gen_random_uuid(), v_be_process_id, 'Autre étude — Réalisation',
   'be', 'manager_dispatch', v_marion_id,
   'fixed_user', v_marion_id, 'requester', true, 190, true),
  (gen_random_uuid(), v_be_process_id, 'Autre étude — Validation',
   'be', 'manager_dispatch', v_marion_id,
   'fixed_user', v_marion_id, NULL, true, 191, true),
  (gen_random_uuid(), v_be_process_id, 'Autre étude — Envoi',
   'be', 'manager_dispatch', v_marion_id,
   'fixed_user', v_marion_id, NULL, true, 192, true)
  ON CONFLICT (id) DO NOTHING;

END $$;
