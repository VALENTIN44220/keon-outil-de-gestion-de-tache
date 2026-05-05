-- ============================================================
-- BE 007 — parallel_group sur sub_process_templates
-- ============================================================
-- Permet de marquer plusieurs étapes d'une même prestation comme
-- exécutables EN PARALLÈLE.
--
-- Logique : étapes triées par order_index. Les étapes consécutives
-- partageant le même `parallel_group` (non-null) sont concurrentes.
-- L'étape (ou groupe) suivant·e n'est débloqué·e que lorsque
-- TOUTES les étapes du groupe en cours ont atteint un statut de
-- déblocage (a_valider, a_deposer, en_instruction, complement_demande,
-- cloturee).
--
-- `parallel_group = NULL` = comportement actuel (chaîne séquentielle
-- stricte). Rétrocompatible : tous les flux existants restent
-- inchangés tant qu'on n'attribue pas un `parallel_group` aux étapes.
-- ============================================================

ALTER TABLE sub_process_templates
  ADD COLUMN IF NOT EXISTS parallel_group INTEGER;

COMMENT ON COLUMN sub_process_templates.parallel_group IS
  'Numéro de groupe parallèle. Étapes consécutives (par order_index) avec le même parallel_group s''exécutent en parallèle. NULL = étape séquentielle.';
