-- ════════════════════════════════════════════════════════════════════════════
-- BE + IT — Vues KPI rebrantchées sur divalto_mouvements_all
-- Classification universelle par CODE TIERS (C*=CA client, F*=COGS fournisseur)
-- + doc_type (commande=engagé, facture=constaté)
--
-- Remplace :
--   • v_be_affaire_budget_kpi       ← be_divalto_mouvements (CCN/CFN/FCN/FFN)
--   • v_it_budget_engage_constate   ← it_divalto_commandes + it_divalto_factures
--   • v_be_divalto_affaires_to_import ← be_divalto_mouvements
--
-- Convention montants dans divalto_mouvements_all :
--   • tiers_code ILIKE 'C%' → client (CA) : montant_ht stocké NÉGATIF
--     → negate pour obtenir CA positif.
--   • tiers_code ILIKE 'F%' → fournisseur (COGS) : montant_ht stocké POSITIF.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. v_be_affaire_budget_kpi ───────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_be_affaire_budget_kpi AS
WITH div AS (
  SELECT
    d.code_affaire,
    /* CA engagé  = commandes client (montants négatifs → negate) */
    -SUM(d.montant_ht) FILTER (WHERE d.tiers_code ILIKE 'C%' AND d.doc_type = 'commande') AS ca_engage_brut,
    /* CA constaté = factures client */
    -SUM(d.montant_ht) FILTER (WHERE d.tiers_code ILIKE 'C%' AND d.doc_type = 'facture')  AS ca_constate_brut,
    /* COGS engagé = commandes fournisseur (déjà positifs) */
     SUM(d.montant_ht) FILTER (WHERE d.tiers_code ILIKE 'F%' AND d.doc_type = 'commande') AS cogs_engage_brut,
    /* COGS constaté = factures fournisseur */
     SUM(d.montant_ht) FILTER (WHERE d.tiers_code ILIKE 'F%' AND d.doc_type = 'facture')  AS cogs_constate_brut,
    COUNT(DISTINCT CASE WHEN d.doc_type = 'commande' THEN d.numero_piece END) AS nb_commandes,
    COUNT(DISTINCT CASE WHEN d.doc_type = 'facture'  THEN d.numero_piece END) AS nb_factures
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
  (COALESCE(d.ca_engage_brut,    0) + COALESCE(d.cogs_engage_brut,   0)) AS engage_montant_brut,
  (COALESCE(d.ca_constate_brut,  0) + COALESCE(d.cogs_constate_brut, 0)) AS constate_montant_brut,
  COALESCE(d.nb_commandes, 0) AS nb_commandes,
  COALESCE(d.nb_factures,  0) AS nb_factures,
  COALESCE(t.jours_declares,  0) AS jours_declares,
  COALESCE(t.cout_rh_declare, 0) AS cout_rh_declare
FROM public.be_affaires a
LEFT JOIN div               d ON d.code_affaire  = a.code_affaire
LEFT JOIN temps_par_affaire t ON t.be_affaire_id = a.id;

COMMENT ON VIEW public.v_be_affaire_budget_kpi IS
  'KPI budgétaires d''une affaire BE : CA/COGS/marges depuis divalto_mouvements_all (tiers_code C*/F*) + temps Lucca. Source unifiée depuis 2026-05-24.';


-- ── 2. v_it_budget_engage_constate ──────────────────────────────────────────
-- Utilise les tables de liens existantes (it_budget_line_commandes / _factures)
-- mais résout les montants depuis divalto_mouvements_all au lieu des anciennes
-- tables it_divalto_commandes / it_divalto_factures.
-- Agrège d'abord par numéro de pièce pour gérer les lignes multi-axes (grain ligne).
CREATE OR REPLACE VIEW public.v_it_budget_engage_constate AS
WITH
piece_commandes AS (
  -- Somme des montants par pièce commande (grain analytique → grain pièce)
  SELECT numero_piece, SUM(montant_ht) AS montant_ht
  FROM public.divalto_mouvements_all
  WHERE doc_type = 'commande'
  GROUP BY numero_piece
),
piece_factures AS (
  SELECT numero_piece, SUM(montant_ht) AS montant_ht
  FROM public.divalto_mouvements_all
  WHERE doc_type = 'facture'
  GROUP BY numero_piece
)
SELECT
  l.id               AS budget_line_id,
  l.it_project_id,
  l.annee,
  l.entite,
  l.categorie,
  l.fournisseur_prevu,
  COALESCE(SUM(pc.montant_ht) FILTER (WHERE lc.id IS NOT NULL), 0) AS engage,
  COALESCE(SUM(pf.montant_ht) FILTER (WHERE lf.id IS NOT NULL), 0) AS constate,
  COUNT(DISTINCT lc.id) AS nb_commandes,
  COUNT(DISTINCT lf.id) AS nb_factures
FROM public.it_budget_lines l
LEFT JOIN public.it_budget_line_commandes lc ON lc.budget_line_id = l.id
LEFT JOIN piece_commandes pc               ON pc.numero_piece    = lc.fullcdno
LEFT JOIN public.it_budget_line_factures  lf ON lf.budget_line_id = l.id
LEFT JOIN piece_factures pf               ON pf.numero_piece    = lf.fullcdno_fac
GROUP BY l.id, l.it_project_id, l.annee, l.entite, l.categorie, l.fournisseur_prevu;

COMMENT ON VIEW public.v_it_budget_engage_constate IS
  'Engagé/constaté par ligne budgétaire IT : liens via it_budget_line_commandes/_factures, montants depuis divalto_mouvements_all. Source unifiée depuis 2026-05-24.';


-- ── 3. v_be_divalto_affaires_to_import ──────────────────────────────────────
-- Vue d'import : codes affaire présents dans Divalto (divalto_mouvements_all)
-- mais pas encore référencés dans be_affaires.
CREATE OR REPLACE VIEW public.v_be_divalto_affaires_to_import AS
WITH divalto_codes AS (
  SELECT
    d.code_affaire,
    COUNT(DISTINCT d.numero_piece)              AS nb_pieces,
    SUM(ABS(COALESCE(d.montant_ht, 0)))         AS montant_total,
    MIN(d.date_piece)                           AS premier_mouvement,
    MAX(d.date_piece)                           AS dernier_mouvement,
    MODE() WITHIN GROUP (ORDER BY d.libelle)    AS libelle_principal
  FROM public.divalto_mouvements_all d
  WHERE d.code_affaire IS NOT NULL AND d.code_affaire <> ''
  GROUP BY d.code_affaire
)
SELECT
  d.code_affaire,
  d.libelle_principal,
  d.nb_pieces,
  d.montant_total,
  d.premier_mouvement,
  d.dernier_mouvement,
  UPPER(LEFT(d.code_affaire, 1))                         AS categorie,
  CASE
    WHEN LENGTH(d.code_affaire) >= 5
    THEN UPPER(SUBSTRING(d.code_affaire FROM 2 FOR 4))
    ELSE NULL
  END                                                     AS code_projet_parent,
  EXISTS (
    SELECT 1 FROM public.be_projects bp
    WHERE LENGTH(d.code_affaire) >= 5
      AND UPPER(bp.code_projet) = UPPER(SUBSTRING(d.code_affaire FROM 2 FOR 4))
  )                                                       AS parent_project_exists
FROM divalto_codes d
WHERE NOT EXISTS (
  SELECT 1 FROM public.be_affaires a
  WHERE a.code_affaire = d.code_affaire
)
ORDER BY d.code_affaire;

COMMENT ON VIEW public.v_be_divalto_affaires_to_import IS
  'Codes affaire dans divalto_mouvements_all non encore importés dans be_affaires. Source unifiée depuis 2026-05-24.';
