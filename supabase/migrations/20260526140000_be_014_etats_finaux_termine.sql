-- ============================================================================
-- BE 014 — États de sortie finaux mal catégorisés (EN_COURS → TERMINE)
-- ============================================================================
-- La dernière étape de certains flux sortait sur un état catégorisé EN_COURS,
-- si bien que la demande n'atteignait jamais la macro-catégorie « Terminé » :
--   - Plan règlementaire  → Envoi               → plans_valides
--   - Offres commerciales  → Validation marge    → validation_marge_ok
--   - Dimensionnement…     → Validation marge    → validation_marge_ok
--   - MOE AVP              → Validation contrats  → contrats_valides
--
-- Ces 3 codes ne sont utilisés QUE comme dernière étape de leur prestation
-- (vérifié), donc la recatégorisation est sans effet de bord.
--
-- NB : la catégorie d'état n'est pas éditable par étape (par conception) ;
-- elle est portée par l'état dans le référentiel request_states.
-- ============================================================================

UPDATE public.request_states
SET state_category = 'TERMINE', updated_at = now()
WHERE process_template_id = 'bd75a3b0-c918-4b43-befe-739b83f7461a'
  AND code IN ('plans_valides', 'validation_marge_ok', 'contrats_valides');
