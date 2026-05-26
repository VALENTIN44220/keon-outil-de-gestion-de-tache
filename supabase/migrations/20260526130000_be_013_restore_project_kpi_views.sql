-- ============================================================================
-- BE 013 — Restaure v_be_project_budget_kpi et v_be_project_synthese_kpi
-- ============================================================================
-- Régression : la migration 012 (20260526120000) a fait
--   DROP VIEW IF EXISTS public.v_be_affaire_budget_kpi CASCADE
-- ce qui a supprimé en cascade les vues dépendantes
--   v_be_project_budget_kpi et v_be_project_synthese_kpi,
-- jamais recréées → page /be/budget (globale) vide alors que les pages
-- budget par projet (qui lisent v_be_affaire_budget_kpi) fonctionnent.
--
-- On recrée ces deux vues à l'identique de leur dernière définition
-- (20260508140000), en sommant les colonnes de v_be_affaire_budget_kpi
-- (recréée en 012, toutes les colonnes nécessaires existent) et de
-- v_be_affaire_temps_kpi.
-- ============================================================================

CREATE OR REPLACE VIEW public.v_be_project_budget_kpi AS
SELECT
  p.id           AS be_project_id,
  p.code_projet,
  COUNT(DISTINCT a.id) AS nb_affaires,
  COALESCE(SUM(k.ca_engage_brut),     0) AS ca_engage_brut,
  COALESCE(SUM(k.ca_constate_brut),   0) AS ca_constate_brut,
  COALESCE(SUM(k.cogs_engage_brut),   0) AS cogs_engage_brut,
  COALESCE(SUM(k.cogs_constate_brut), 0) AS cogs_constate_brut,
  COALESCE(SUM(k.marge_constatee_brut), 0) AS marge_constatee_brut,
  COALESCE(SUM(k.marge_brute_brut), 0)   AS marge_brute_brut,
  COALESCE(SUM(k.marge_directe_brut), 0) AS marge_directe_brut,
  COALESCE(SUM(k.engage_montant_brut),  0) AS engage_montant_brut,
  COALESCE(SUM(k.constate_montant_brut), 0) AS constate_montant_brut,
  COALESCE(SUM(k.nb_commandes),  0) AS nb_commandes,
  COALESCE(SUM(k.nb_factures),   0) AS nb_factures
FROM public.be_projects p
LEFT JOIN public.be_affaires a            ON a.be_project_id = p.id
LEFT JOIN public.v_be_affaire_budget_kpi k ON k.be_affaire_id = a.id
GROUP BY p.id, p.code_projet;

CREATE OR REPLACE VIEW public.v_be_project_synthese_kpi AS
SELECT
  p.id                                     AS be_project_id,
  p.code_projet,
  p.nom_projet,
  p.status,
  COUNT(DISTINCT a.id)                     AS nb_affaires,
  COALESCE(SUM(b.ca_engage_brut), 0)       AS ca_engage_brut,
  COALESCE(SUM(b.ca_constate_brut), 0)     AS ca_constate_brut,
  COALESCE(SUM(b.cogs_engage_brut), 0)     AS cogs_engage_brut,
  COALESCE(SUM(b.cogs_constate_brut), 0)   AS cogs_constate_brut,
  COALESCE(SUM(b.marge_constatee_brut), 0) AS marge_constatee_brut,
  COALESCE(SUM(b.marge_brute_brut), 0)     AS marge_brute_brut,
  COALESCE(SUM(b.marge_directe_brut), 0)   AS marge_directe_brut,
  COALESCE(SUM(b.nb_commandes), 0)         AS nb_commandes,
  COALESCE(SUM(b.nb_factures), 0)          AS nb_factures,
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
