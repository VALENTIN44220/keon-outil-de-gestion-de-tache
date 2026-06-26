-- =========================================================================
-- Plan de charge IT — Scénarios multi-leviers
-- Étend fdr_hire_scenarios pour faire varier, par scénario :
--   1. les dates de lancement des projets (override par projet)
--   2. l'externalisation par projet (sous-traitance ciblée)
--   3. les embauches (renforts — colonne hires existante)
-- + des hypothèses de coût pour le ROI agrégé du scénario.
--
-- Additif et rétro-compatible : les scénarios existants conservent
-- project_overrides = [] et assumptions = {} (aucune régression).
-- =========================================================================

ALTER TABLE public.fdr_hire_scenarios
  ADD COLUMN IF NOT EXISTS project_overrides jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS assumptions       jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.fdr_hire_scenarios.project_overrides IS
  'Overrides projet par scénario : [{ it_project_id, date_kickoff?, date_mep_saisie?, externe?, pct_reduction_si_externe?, budget_externe_eur? }]. Champs absents = valeur d''origine du projet.';

COMMENT ON COLUMN public.fdr_hire_scenarios.assumptions IS
  'Hypothèses de coût pour le ROI agrégé du scénario : { cout_annuel_etp_embauche?: number, tjm_st?: number }.';

COMMENT ON TABLE public.fdr_hire_scenarios IS
  'Scénarios multi-leviers du plan de charge IT : hires (renforts), project_overrides (dates + externalisation par projet), assumptions (coûts ROI).';
