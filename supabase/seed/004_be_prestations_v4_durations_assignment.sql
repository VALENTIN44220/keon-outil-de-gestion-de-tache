-- ============================================================
-- SEED 004 : Prestations BE v4 — durées + cible directe + ordre ICPE
-- ============================================================
-- Pré-requis : migration 20260509120000_be_006_subprocess_default_duration_hours
--              (colonne default_duration_hours sur sub_process_templates).
--
-- Modifications selon le tableau métier :
--  1. Réordonne ICPE Déclaration : Dépôt → Complétude → Publication → Purge
--  2. Renseigne default_duration_hours selon le tableau (3j=24h, 1j=8h, etc.)
--  3. Étapes où Cible = personne précise (Guillaume, projeteur) → pré-
--     affectation directe sur target_assignee_id, plus de dispatcher.
--     Ces étapes sont :
--       - ICPE Déclaration — Réalisation des plans
--       - ICPE Enregistrement — Réalisation des plans
--       - Permis de construire — Réalisation plan pour PC
--       - Agrément sanitaire — Réalisation des plans
--     Validation N1 = Florence, N2 = demandeur (cf. tableau).
--
-- Idempotent : que des UPDATEs (pas d'INSERT, pas de DELETE).
-- ============================================================

DO $$
DECLARE
  v_be_process_id UUID := 'bd75a3b0-c918-4b43-befe-739b83f7461a';
  v_florence_id   UUID := '17e506f2-8b1e-46e5-8641-84de7025c999';
  v_guillaume_id  UUID := '4e4254bd-fd71-4933-a314-96826ce0a968'; -- MORICEAU Guillaume (Projeteur)
BEGIN

  -- ──────────────────────────────────────────────────────────
  -- 1. Réordonner ICPE Déclaration
  --    Avant : Dépôt(12) → Publication(13) → Complétude(14) → Purge(15)
  --    Après : Dépôt(12) → Complétude(13) → Publication(14) → Purge(15)
  -- ──────────────────────────────────────────────────────────
  UPDATE sub_process_templates SET order_index = 13
   WHERE process_template_id = v_be_process_id
     AND name = 'ICPE Déclaration — Complétude obtenue';
  UPDATE sub_process_templates SET order_index = 14
   WHERE process_template_id = v_be_process_id
     AND name = 'ICPE Déclaration — Publication preuve de dépôt';

  -- ──────────────────────────────────────────────────────────
  -- 2. Durées prévues (heures) — héritées par tasks.duration_hours
  --    Conversions : 1j = 8h, 2j = 16h, 3j = 24h, 7j = 56h, 10j = 80h
  -- ──────────────────────────────────────────────────────────

  -- ICPE Déclaration
  UPDATE sub_process_templates SET default_duration_hours = 24
   WHERE process_template_id = v_be_process_id
     AND name = 'ICPE Déclaration — Réalisation du dossier';   -- 3 jours
  UPDATE sub_process_templates SET default_duration_hours = 8
   WHERE process_template_id = v_be_process_id
     AND name = 'ICPE Déclaration — Réalisation des plans';    -- 1 jour

  -- ICPE Enregistrement
  UPDATE sub_process_templates SET default_duration_hours = 80
   WHERE process_template_id = v_be_process_id
     AND name = 'ICPE Enregistrement — Réalisation du dossier'; -- 10 jours
  UPDATE sub_process_templates SET default_duration_hours = 8
   WHERE process_template_id = v_be_process_id
     AND name = 'ICPE Enregistrement — Réalisation des plans';  -- 1 jour

  -- Permis de construire
  UPDATE sub_process_templates SET default_duration_hours = 8
   WHERE process_template_id = v_be_process_id
     AND name = 'Permis de construire — Réalisation plan pour PC'; -- 1 jour
  UPDATE sub_process_templates SET default_duration_hours = 16
   WHERE process_template_id = v_be_process_id
     AND name = 'Permis de construire — Réalisation dossier';      -- 2 jours

  -- Agrément sanitaire
  UPDATE sub_process_templates SET default_duration_hours = 56
   WHERE process_template_id = v_be_process_id
     AND name = 'Agrément sanitaire — Réalisation du dossier';  -- 7 jours
  UPDATE sub_process_templates SET default_duration_hours = 8
   WHERE process_template_id = v_be_process_id
     AND name = 'Agrément sanitaire — Réalisation des plans';   -- 1 jour

  -- ──────────────────────────────────────────────────────────
  -- 3. Étapes "Réalisation des plans" — Cible = Guillaume Moriceau
  --    → assignment_type = 'fixed_user', plus de dispatcher
  --    → validation N1 = Florence, N2 = demandeur
  -- ──────────────────────────────────────────────────────────

  UPDATE sub_process_templates
   SET assignment_type            = 'fixed_user',
       target_assignee_id         = v_guillaume_id,
       dispatch_manager_id        = NULL,
       validation_level_1_type    = 'fixed_user',
       validation_level_1_user_id = v_florence_id,
       validation_level_2_type    = 'requester',
       validation_level_2_user_id = NULL
   WHERE process_template_id = v_be_process_id
     AND name IN (
       'ICPE Déclaration — Réalisation des plans',
       'ICPE Enregistrement — Réalisation des plans',
       'Permis de construire — Réalisation plan pour PC',
       'Agrément sanitaire — Réalisation des plans'
     );

  RAISE NOTICE 'Seed 004 (BE prestations v4) appliqué : ordre ICPE Décl., durées (8 étapes), cible directe Guillaume (4 étapes)';
END $$;
