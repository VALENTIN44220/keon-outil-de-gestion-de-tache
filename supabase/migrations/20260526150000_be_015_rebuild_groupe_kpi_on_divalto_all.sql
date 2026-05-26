-- ============================================================================
-- BE 015 — Reconstruit v_be_groupe_kpi sur divalto_mouvements_all
-- ============================================================================
-- v_be_groupe_kpi (KPI par préfixe 5 chars du code_affaire) pointait sur
-- l'ancienne table be_divalto_mouvements, supprimée lors de l'unification
-- Divalto (la vue a donc été perdue). Elle est pourtant utilisée par la page
-- budget projet (BEProjectHubBudget → useBEGroupeKpis).
--
-- On la reconstruit sur divalto_mouvements_all en reprenant exactement le
-- mapping de v_be_affaire_budget_kpi (client = tiers_code ILIKE 'C%' avec
-- montants négatifs d'où -SUM ; fournisseur = 'F%' ; doc_type commande/facture)
-- et on agrège le temps/coût RH depuis v_be_affaire_temps_kpi (logique TJM
-- déjà correcte), par préfixe.
-- ============================================================================

CREATE OR REPLACE VIEW public.v_be_groupe_kpi AS
WITH div AS (
  SELECT
    SUBSTRING(code_affaire, 1, 5) AS code_groupe,
    -SUM(montant_ht) FILTER (WHERE tiers_code ILIKE 'C%' AND doc_type = 'commande') AS ca_engage_brut,
    -SUM(montant_ht) FILTER (WHERE tiers_code ILIKE 'C%' AND doc_type = 'facture')  AS ca_constate_brut,
     SUM(montant_ht) FILTER (WHERE tiers_code ILIKE 'F%' AND doc_type = 'commande') AS cogs_engage_brut,
     SUM(montant_ht) FILTER (WHERE tiers_code ILIKE 'F%' AND doc_type = 'facture')  AS cogs_constate_brut,
     COUNT(DISTINCT CASE WHEN doc_type = 'commande' THEN numero_piece END) AS nb_commandes,
     COUNT(DISTINCT CASE WHEN doc_type = 'facture'  THEN numero_piece END) AS nb_factures,
     COUNT(DISTINCT code_affaire) AS nb_activites_divalto
  FROM public.divalto_mouvements_all
  WHERE code_affaire IS NOT NULL AND length(code_affaire) >= 5
  GROUP BY SUBSTRING(code_affaire, 1, 5)
),
temps AS (
  SELECT
    SUBSTRING(a.code_affaire, 1, 5) AS code_groupe,
    SUM(t.jours_budgetes)  AS jours_budgetes,
    SUM(t.cout_rh_budgete) AS cout_rh_budgete,
    SUM(t.heures_declarees) AS heures_declarees,
    SUM(t.jours_declares)   AS jours_declares,
    SUM(t.cout_rh_declare)  AS cout_rh_declare
  FROM public.be_affaires a
  JOIN public.v_be_affaire_temps_kpi t ON t.be_affaire_id = a.id
  WHERE a.code_affaire IS NOT NULL AND length(a.code_affaire) >= 5
  GROUP BY SUBSTRING(a.code_affaire, 1, 5)
),
collab AS (
  SELECT
    SUBSTRING(code_site, 1, 5) AS code_groupe,
    COUNT(DISTINCT user_id) AS nb_collaborateurs
  FROM public.lucca_saisie_temps
  WHERE code_site IS NOT NULL AND length(code_site) >= 5
  GROUP BY SUBSTRING(code_site, 1, 5)
),
all_groupes AS (
  SELECT code_groupe FROM div
  UNION SELECT code_groupe FROM temps
  UNION SELECT code_groupe FROM collab
),
projet_par_groupe AS (
  SELECT DISTINCT ON (g.code_groupe) g.code_groupe, a.be_project_id
  FROM all_groupes g
  LEFT JOIN public.be_affaires a
    ON length(a.code_affaire) >= 5
   AND SUBSTRING(a.code_affaire, 1, 5) = g.code_groupe
  ORDER BY g.code_groupe, length(a.code_affaire)
)
SELECT
  g.code_groupe,
  pg.be_project_id,
  COALESCE(d.ca_engage_brut,     0) AS ca_engage_brut,
  COALESCE(d.ca_constate_brut,   0) AS ca_constate_brut,
  COALESCE(d.cogs_engage_brut,   0) AS cogs_engage_brut,
  COALESCE(d.cogs_constate_brut, 0) AS cogs_constate_brut,
  0::numeric AS ndf_brut,
  COALESCE(d.ca_constate_brut, 0) - COALESCE(d.cogs_constate_brut, 0) AS marge_constatee_brut,
  COALESCE(d.ca_constate_brut, 0) - COALESCE(d.cogs_constate_brut, 0) AS marge_brute_brut,
  COALESCE(d.ca_constate_brut, 0) - COALESCE(d.cogs_constate_brut, 0) - COALESCE(tp.cout_rh_declare, 0) AS marge_directe_brut,
  COALESCE(d.nb_commandes, 0) AS nb_commandes,
  COALESCE(d.nb_factures,  0) AS nb_factures,
  COALESCE(d.nb_activites_divalto, 0) AS nb_activites_divalto,
  COALESCE(tp.jours_budgetes,   0) AS jours_budgetes,
  COALESCE(tp.cout_rh_budgete,  0) AS cout_rh_budgete,
  COALESCE(tp.heures_declarees, 0) AS heures_declarees,
  COALESCE(tp.jours_declares,   0) AS jours_declares,
  COALESCE(tp.cout_rh_declare,  0) AS cout_rh_declare,
  COALESCE(c.nb_collaborateurs, 0) AS nb_collaborateurs
FROM all_groupes g
LEFT JOIN div d              ON d.code_groupe  = g.code_groupe
LEFT JOIN temps tp           ON tp.code_groupe = g.code_groupe
LEFT JOIN collab c           ON c.code_groupe  = g.code_groupe
LEFT JOIN projet_par_groupe pg ON pg.code_groupe = g.code_groupe;
