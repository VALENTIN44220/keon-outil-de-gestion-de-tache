-- ════════════════════════════════════════════════════════════════════════════
-- Devis (doc_type='devis') ajoutés aux vues KPI BE + SPV
-- Colonnes ajoutées :
--   devis_client_brut     → montant devis côté client (tiers C%, inversé)
--   devis_fournisseur_brut → montant devis côté fournisseur (tiers F%)
--   nb_devis              → nombre de pièces devis distinctes
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. v_be_affaire_budget_kpi ───────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_be_affaire_budget_kpi AS
WITH div AS (
  SELECT
    d.code_affaire,
    -SUM(d.montant_ht) FILTER (WHERE d.tiers_code ILIKE 'C%' AND d.doc_type = 'commande') AS ca_engage_brut,
    -SUM(d.montant_ht) FILTER (WHERE d.tiers_code ILIKE 'C%' AND d.doc_type = 'facture')  AS ca_constate_brut,
     SUM(d.montant_ht) FILTER (WHERE d.tiers_code ILIKE 'F%' AND d.doc_type = 'commande') AS cogs_engage_brut,
     SUM(d.montant_ht) FILTER (WHERE d.tiers_code ILIKE 'F%' AND d.doc_type = 'facture')  AS cogs_constate_brut,
    -SUM(d.montant_ht) FILTER (WHERE d.tiers_code ILIKE 'C%' AND d.doc_type = 'devis')    AS devis_client_brut,
     SUM(d.montant_ht) FILTER (WHERE d.tiers_code ILIKE 'F%' AND d.doc_type = 'devis')    AS devis_fournisseur_brut,
    COUNT(DISTINCT CASE WHEN d.doc_type = 'commande' THEN d.numero_piece END) AS nb_commandes,
    COUNT(DISTINCT CASE WHEN d.doc_type = 'facture'  THEN d.numero_piece END) AS nb_factures,
    COUNT(DISTINCT CASE WHEN d.doc_type = 'devis'    THEN d.numero_piece END) AS nb_devis
  FROM public.divalto_mouvements_all d
  WHERE d.code_affaire IS NOT NULL
  GROUP BY d.code_affaire
),
temps_par_affaire AS (
  SELECT be_affaire_id, jours_declares, cout_rh_declare
  FROM public.v_be_affaire_temps_kpi
)
SELECT
  a.id           AS be_affaire_id,
  a.be_project_id,
  a.code_affaire,
  a.libelle      AS affaire_libelle,
  a.status       AS affaire_status,
  -- colonnes existantes (ordre inchangé)
  COALESCE(d.ca_engage_brut,     0) AS ca_engage_brut,
  COALESCE(d.ca_constate_brut,   0) AS ca_constate_brut,
  COALESCE(d.cogs_engage_brut,   0) AS cogs_engage_brut,
  COALESCE(d.cogs_constate_brut, 0) AS cogs_constate_brut,
  (COALESCE(d.ca_constate_brut, 0) - COALESCE(d.cogs_constate_brut, 0))
    AS marge_constatee_brut,
  (COALESCE(d.ca_constate_brut, 0) - COALESCE(d.cogs_constate_brut, 0))
    AS marge_brute_brut,
  (COALESCE(d.ca_constate_brut, 0) - COALESCE(d.cogs_constate_brut, 0)
   - COALESCE(t.cout_rh_declare, 0))
    AS marge_directe_brut,
  (COALESCE(d.ca_engage_brut, 0) + COALESCE(d.cogs_engage_brut, 0))     AS engage_montant_brut,
  (COALESCE(d.ca_constate_brut, 0) + COALESCE(d.cogs_constate_brut, 0)) AS constate_montant_brut,
  COALESCE(d.nb_commandes, 0) AS nb_commandes,
  COALESCE(d.nb_factures,  0) AS nb_factures,
  COALESCE(t.jours_declares,  0) AS jours_declares,
  COALESCE(t.cout_rh_declare, 0) AS cout_rh_declare,
  -- nouvelles colonnes devis (ajoutées en fin)
  COALESCE(d.devis_client_brut,      0) AS devis_client_brut,
  COALESCE(d.devis_fournisseur_brut, 0) AS devis_fournisseur_brut,
  COALESCE(d.nb_devis, 0)               AS nb_devis
FROM public.be_affaires a
LEFT JOIN div               d ON d.code_affaire  = a.code_affaire
LEFT JOIN temps_par_affaire t ON t.be_affaire_id = a.id;

COMMENT ON VIEW public.v_be_affaire_budget_kpi IS
  'KPI budgétaires affaire BE : CA/COGS/devis/marges depuis divalto_mouvements_all (tiers C*/F*) + temps Lucca. Devis ajoutés 2026-05-24.';


-- ── 2. v_spv_affaire_budget_kpi ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_spv_affaire_budget_kpi AS
WITH temps AS (
  SELECT code_affaire, jours_declares, cout_rh_declare
  FROM public.v_spv_affaire_temps_kpi
),
div AS (
  SELECT
    axe_0001 AS code_affaire,
    -COALESCE(SUM(montant_ht) FILTER (WHERE tiers_code ILIKE 'C%' AND doc_type = 'commande'), 0) AS ca_engage,
    -COALESCE(SUM(montant_ht) FILTER (WHERE tiers_code ILIKE 'C%' AND doc_type = 'facture'),  0) AS ca_constate,
     COALESCE(SUM(montant_ht) FILTER (WHERE tiers_code ILIKE 'F%' AND doc_type = 'commande'), 0) AS cogs_engage,
     COALESCE(SUM(montant_ht) FILTER (WHERE tiers_code ILIKE 'F%' AND doc_type = 'facture'),  0) AS cogs_constate,
    -COALESCE(SUM(montant_ht) FILTER (WHERE tiers_code ILIKE 'C%' AND doc_type = 'devis'),    0) AS devis_client,
     COALESCE(SUM(montant_ht) FILTER (WHERE tiers_code ILIKE 'F%' AND doc_type = 'devis'),    0) AS devis_fournisseur,
    COUNT(DISTINCT CASE WHEN doc_type = 'commande' THEN numero_piece END) AS nb_commandes,
    COUNT(DISTINCT CASE WHEN doc_type = 'facture'  THEN numero_piece END) AS nb_factures,
    COUNT(DISTINCT CASE WHEN doc_type = 'devis'    THEN numero_piece END) AS nb_devis
  FROM public.divalto_mouvements_all
  WHERE axe_0001 ILIKE 'M%'
  GROUP BY axe_0001
),
budget AS (
  SELECT spv_affaire_id, SUM(COALESCE(montant_budget_revise, montant_budget)) AS budget_total
  FROM public.spv_affaire_budget_lines
  GROUP BY spv_affaire_id
)
SELECT
  a.id          AS spv_affaire_id,
  a.code_affaire,
  a.libelle     AS affaire_libelle,
  a.status      AS affaire_status,
  -- colonnes existantes (ordre inchangé)
  COALESCE(d.ca_engage,     0::numeric) AS ca_engage_brut,
  COALESCE(d.ca_constate,   0::numeric) AS ca_constate_brut,
  COALESCE(d.cogs_engage,   0::numeric) AS cogs_engage_brut,
  COALESCE(d.cogs_constate, 0::numeric) AS cogs_constate_brut,
  COALESCE(d.ca_constate, 0::numeric) - COALESCE(d.cogs_constate, 0::numeric)
    AS marge_brute,
  COALESCE(d.ca_constate, 0::numeric) - COALESCE(d.cogs_constate, 0::numeric)
    - COALESCE(t.cout_rh_declare, 0)
    AS marge_directe,
  COALESCE(d.nb_commandes, 0)             AS nb_commandes,
  COALESCE(d.nb_factures,  0)             AS nb_factures,
  COALESCE(t.jours_declares,  0::numeric) AS jours_declares,
  COALESCE(t.cout_rh_declare, 0::numeric) AS cout_rh_declare,
  COALESCE(b.budget_total,    0::numeric) AS budget_total,
  -- nouvelles colonnes devis (ajoutées en fin)
  COALESCE(d.devis_client,      0::numeric) AS devis_client_brut,
  COALESCE(d.devis_fournisseur, 0::numeric) AS devis_fournisseur_brut,
  COALESCE(d.nb_devis, 0)                   AS nb_devis
FROM public.spv_affaires a
LEFT JOIN div    d ON d.code_affaire    = a.code_affaire
LEFT JOIN temps  t ON t.code_affaire    = a.code_affaire
LEFT JOIN budget b ON b.spv_affaire_id  = a.id;

COMMENT ON VIEW public.v_spv_affaire_budget_kpi IS
  'KPI budgétaires affaire SPV : CA/COGS/devis/marges depuis divalto_mouvements_all (tiers C*/F*, axe_0001 M%) + temps Lucca. Devis ajoutés 2026-05-24.';
