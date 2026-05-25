-- =============================================================================
-- Migration 010 : Nettoyage templates BE en double / orphelins
-- Date : 2026-05-26
-- ⚠️  TOUJOURS tester en staging avant production
-- ⚠️  Vérifier qu'aucune tâche active ne référence ces templates
-- =============================================================================

-- ÉTAPE 0 : Vérifier que les templates à supprimer n'ont pas de tâches actives
-- (à exécuter avant la suppression - NE PAS exécuter si résultat non vide)
/*
SELECT t.id, t.name AS tache, spt.name AS template, spt.be_category, t.be_status
FROM tasks t
JOIN sub_process_templates spt ON spt.id = t.sub_process_template_id
WHERE spt.process_template_id = 'bd75a3b0-c918-4b43-befe-739b83f7461a'
  AND (
    spt.be_category IS NULL
    OR (spt.be_category = 'be' AND spt.name IN (
      'Étude de terrain', 'Étude photovoltaïque', 'Étude CO2', 'Étude des odeurs',
      'Étude acoustique', 'Étude faune et flore', 'Plan d''Assurance Construction',
      'Dossier de subvention', 'Dimensionnement et chiffrage hors offre',
      'MOE AVP', 'MOE PRO', 'Maîtrise d''Œuvre Exécution',
      'AUDIT PROCESS', 'RACCORDEMENT', 'Offres commerciale'
    ))
    OR (spt.be_category = 'be_reglementaire' AND spt.name IN (
      'Permis de construire', 'Agrément sanitaire', 'Plan règlementaire',
      'dossier icpe declaration', 'dossier icpe enregistrement', 'dossier icpe autorisation'
    ))
  )
  AND t.be_status NOT IN ('cloturee');
*/

-- =============================================================================
-- ÉTAPE 1 : Supprimer les sub_process_step_fields des templates à supprimer
-- =============================================================================

-- 1A : Orphelins (be_category NULL)
DELETE FROM sub_process_step_fields
WHERE sub_process_template_id IN (
  SELECT id FROM sub_process_templates
  WHERE process_template_id = 'bd75a3b0-c918-4b43-befe-739b83f7461a'
    AND be_category IS NULL
);

-- 1B : Doublons be
DELETE FROM sub_process_step_fields
WHERE sub_process_template_id IN (
  SELECT id FROM sub_process_templates
  WHERE process_template_id = 'bd75a3b0-c918-4b43-befe-739b83f7461a'
    AND be_category = 'be'
    AND name IN (
      'Étude de terrain', 'Étude photovoltaïque', 'Étude CO2', 'Étude des odeurs',
      'Étude acoustique', 'Étude faune et flore', 'Plan d''Assurance Construction',
      'Dossier de subvention', 'Dimensionnement et chiffrage hors offre',
      'MOE AVP', 'MOE PRO', 'Maîtrise d''Œuvre Exécution',
      'AUDIT PROCESS', 'RACCORDEMENT', 'Offres commerciale'
    )
);

-- 1C : Doublons be_reglementaire + résidus test
DELETE FROM sub_process_step_fields
WHERE sub_process_template_id IN (
  SELECT id FROM sub_process_templates
  WHERE process_template_id = 'bd75a3b0-c918-4b43-befe-739b83f7461a'
    AND be_category = 'be_reglementaire'
    AND name IN (
      'Permis de construire', 'Agrément sanitaire', 'Plan règlementaire',
      'dossier icpe declaration', 'dossier icpe enregistrement', 'dossier icpe autorisation'
    )
);

-- =============================================================================
-- ÉTAPE 2 : Supprimer les templates orphelins (be_category NULL)
-- =============================================================================

DELETE FROM sub_process_templates
WHERE process_template_id = 'bd75a3b0-c918-4b43-befe-739b83f7461a'
  AND be_category IS NULL;

-- Résultat attendu : 20 lignes supprimées
-- (EDT TERRAIN, EDT PV, EDT CO2, PC, ICPE declaration, ICPE enregistrement,
--  ICPE autorisation, COMPLEMENT INSTRUCTION, ASAN, PAC, ODEURS, BRUITS,
--  AUDIT PROCESS, RACCORDEMENT, DIMENSIONNEMENT/CHIFFRAGE, PLAN REGLE,
--  SUBVENTION, MOE AVP, MOE PRO, FAUNE FLORE)

-- =============================================================================
-- ÉTAPE 3 : Supprimer les doublons be (anciens templates non-splittés)
-- =============================================================================

DELETE FROM sub_process_templates
WHERE process_template_id = 'bd75a3b0-c918-4b43-befe-739b83f7461a'
  AND be_category = 'be'
  AND name IN (
    'Étude de terrain',           -- remplacé par — Réalisation/Validation/Envoi (140-142)
    'Étude photovoltaïque',       -- remplacé par — Réalisation/Validation/Envoi (150-152)
    'Étude CO2',                  -- remplacé par — Réalisation/Validation/Envoi (160-162)
    'Étude des odeurs',           -- remplacé par réglementaire (80-82)
    'Étude acoustique',           -- remplacé par réglementaire (90-92)
    'Étude faune et flore',       -- remplacé par réglementaire (110-112)
    'Plan d''Assurance Construction', -- remplacé par réglementaire (70-72)
    'Dossier de subvention',      -- remplacé par — Réalisation/Validation/Envoi (180-182)
    'Dimensionnement et chiffrage hors offre', -- remplacé par 4 étapes (130-133)
    'MOE AVP',                    -- remplacé par — Réalisation/Validation/Envoi (210-212)
    'MOE PRO',                    -- remplacé par — Réalisation/Validation/Envoi (220-222)
    'Maîtrise d''Œuvre Exécution', -- remplacé par — Réalisation/Validation/Envoi (230-232)
    'AUDIT PROCESS',              -- remplacé par Audit process — Réalisation/Validation/Envoi (170-172)
    'RACCORDEMENT',               -- remplacé par Raccordement — Réalisation/Validation/Envoi (200-202)
    'Offres commerciale'          -- typo + doublon avec Offres commerciales
  );

-- =============================================================================
-- ÉTAPE 4 : Supprimer les doublons be_reglementaire et résidus test
-- =============================================================================

DELETE FROM sub_process_templates
WHERE process_template_id = 'bd75a3b0-c918-4b43-befe-739b83f7461a'
  AND be_category = 'be_reglementaire'
  AND name IN (
    'Permis de construire',        -- doublon avec PC — 8 étapes détaillées (50-58)
    'Agrément sanitaire',          -- doublon avec Agrément — 8 étapes détaillées (60-68)
    'Plan règlementaire',          -- doublon avec Plan régl. — 3 étapes (100-102) à order_index 150
    'dossier icpe declaration',    -- résidu test
    'dossier icpe enregistrement', -- résidu test
    'dossier icpe autorisation'    -- résidu test
  );

-- =============================================================================
-- ÉTAPE 5 : Corriger le dispatcher (Florence → Marion) sur templates BE commercial
-- =============================================================================

UPDATE sub_process_templates
SET dispatch_manager_id = '23c7a2c7-14aa-48cf-9dd0-c06c91f5c947' -- Marion PAVAT
WHERE process_template_id = 'bd75a3b0-c918-4b43-befe-739b83f7461a'
  AND be_category = 'be'
  AND dispatch_manager_id = '17e506f2-8b1e-46e5-8641-84de7025c999' -- Florence (incorrect)
  AND name IN (
    'AUDIT PROCESS',
    'RACCORDEMENT',
    'Dossier de subvention',
    'MOE AVP',
    'MOE PRO',
    'Maîtrise d''Œuvre Exécution'
  );

-- Résultat attendu : 0-6 lignes (selon si déjà supprimés à l'étape 3)

-- =============================================================================
-- VÉRIFICATION FINALE
-- =============================================================================

-- Compter les templates restants par catégorie
SELECT
  COALESCE(be_category, 'NULL') AS categorie,
  COUNT(*) AS nb_templates
FROM sub_process_templates
WHERE process_template_id = 'bd75a3b0-c918-4b43-befe-739b83f7461a'
GROUP BY be_category
ORDER BY be_category;

-- Résultats attendus après nettoyage :
-- be             : ~37 templates (Offres 4 + Dim 4 + 10 prestations × 3 étapes)
-- be_reglementaire : ~43 templates (ICPE Déc 6 + ICPE Enreg 11 + ICPE Auto 3 + PC 8 + Agr 8 + 5×3)
-- NULL           : 0 (tous supprimés)
