-- ============================================================
-- SEED 005 : parallel_group sur les étapes "plans + dossier"
-- ============================================================
-- Pré-requis : migration 20260510120000_be_007_subprocess_parallel_group
--              (colonne parallel_group sur sub_process_templates).
--
-- Pour 4 prestations, le dossier et les plans peuvent être réalisés
-- en parallèle. On les marque parallel_group = 1 ; les étapes
-- suivantes (Dépôt, etc.) attendent que TOUTES les étapes du groupe 1
-- soient validées.
--
-- Idempotent : que des UPDATEs.
-- ============================================================

DO $$
DECLARE
  v_be_process_id UUID := 'bd75a3b0-c918-4b43-befe-739b83f7461a';
BEGIN

  -- ICPE Déclaration : Réalisation du dossier (10) || Réalisation des plans (11)
  UPDATE sub_process_templates SET parallel_group = 1
   WHERE process_template_id = v_be_process_id
     AND name IN (
       'ICPE Déclaration — Réalisation du dossier',
       'ICPE Déclaration — Réalisation des plans'
     );

  -- ICPE Enregistrement : Réalisation du dossier (20) || Réalisation des plans (21)
  UPDATE sub_process_templates SET parallel_group = 1
   WHERE process_template_id = v_be_process_id
     AND name IN (
       'ICPE Enregistrement — Réalisation du dossier',
       'ICPE Enregistrement — Réalisation des plans'
     );

  -- Permis de construire : Réalisation plan PC (50) || Réalisation dossier (51)
  UPDATE sub_process_templates SET parallel_group = 1
   WHERE process_template_id = v_be_process_id
     AND name IN (
       'Permis de construire — Réalisation plan PC',
       'Permis de construire — Réalisation dossier'
     );

  -- Agrément sanitaire : Réalisation du dossier (60) || Réalisation des plans (61)
  UPDATE sub_process_templates SET parallel_group = 1
   WHERE process_template_id = v_be_process_id
     AND name IN (
       'Agrément sanitaire — Réalisation du dossier',
       'Agrément sanitaire — Réalisation des plans'
     );

  RAISE NOTICE 'Seed 005 (parallel groups) appliqué : 4 prestations × 2 étapes = 8 lignes mises à jour';
END $$;

-- Vérification
SELECT name, order_index, parallel_group
FROM sub_process_templates
WHERE process_template_id = 'bd75a3b0-c918-4b43-befe-739b83f7461a'
  AND parallel_group IS NOT NULL
ORDER BY order_index;
