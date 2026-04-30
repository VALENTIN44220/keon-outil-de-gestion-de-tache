-- ============================================================================
-- BE - Synthese KPI par projet (vue unifiee Budget + Temps + RH)
-- ============================================================================
-- Vue dediee au dashboard BE (page /projects). Agregation projet x toutes ses
-- affaires : CA / COGS / Marge (Divalto) + Jours budgetes/planifies/declares
-- + Couts RH (Lucca x TJM).
-- ============================================================================

CREATE OR REPLACE VIEW public.v_be_project_synthese_kpi AS
SELECT
  p.id                                     AS be_project_id,
  p.code_projet,
  p.nom_projet,
  p.status,
  COUNT(DISTINCT a.id)                     AS nb_affaires,
  -- Budget Divalto
  COALESCE(SUM(b.ca_engage_brut), 0)       AS ca_engage_brut,
  COALESCE(SUM(b.ca_constate_brut), 0)     AS ca_constate_brut,
  COALESCE(SUM(b.cogs_engage_brut), 0)     AS cogs_engage_brut,
  COALESCE(SUM(b.cogs_constate_brut), 0)   AS cogs_constate_brut,
  COALESCE(SUM(b.marge_constatee_brut), 0) AS marge_constatee_brut,
  COALESCE(SUM(b.nb_commandes), 0)         AS nb_commandes,
  COALESCE(SUM(b.nb_factures), 0)          AS nb_factures,
  -- Temps & RH
  COALESCE(SUM(t.jours_budgetes), 0)       AS jours_budgetes,
  COALESCE(SUM(t.cout_rh_budgete), 0)      AS cout_rh_budgete,
  COALESCE(SUM(t.jours_planifies), 0)      AS jours_planifies,
  COALESCE(SUM(t.cout_rh_planifie), 0)     AS cout_rh_planifie,
  COALESCE(SUM(t.jours_declares), 0)       AS jours_declares,
  COALESCE(SUM(t.cout_rh_declare), 0)      AS cout_rh_declare
FROM public.be_projects p
LEFT JOIN public.be_affaires a            ON a.be_project_id = p.id
LEFT JOIN public.v_be_affaire_budget_kpi b ON b.be_affaire_id = a.id
LEFT JOIN public.v_be_affaire_temps_kpi t  ON t.be_affaire_id = a.id
GROUP BY p.id, p.code_projet, p.nom_projet, p.status;

COMMENT ON VIEW public.v_be_project_synthese_kpi IS
  'Synthese KPIs par projet BE pour le dashboard /projects (variant=be) : CA / COGS / Marge / Jours / Cout RH agreges sur toutes les affaires du projet.';
