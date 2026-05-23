-- SPV budget v3 : CA + COGS depuis la table unifiée divalto_mouvements_all.
-- (remplace la source it_divalto_* — désormais la table unifiée porte TOUT
-- Divalto, dont les pièces client TerGreen 'M' qui donnent enfin le CA.)
--
-- Classification par préfixe de pièce :
--   CA  (vente, client)      : CC% (commande) / FC% (facture) → négatif en base, on inverse
--   COGS (achat, fournisseur): CF% (commande) / FF% (facture) → déjà positif
-- Pièces à préfixe NULL ou avoirs (AC/AF) : exclues (non classables de façon fiable).
-- Grain affaire = projet (axe_0001, 5 car. ex. MALIX), aligné sur spv_affaires.

CREATE OR REPLACE VIEW public.v_spv_affaire_budget_kpi AS
WITH temps AS (
  SELECT code_affaire, jours_declares, cout_rh_declare FROM public.v_spv_affaire_temps_kpi
),
div AS (
  SELECT
    axe_0001 AS code_affaire,
    -COALESCE(SUM(montant_ht) FILTER (WHERE prefix ILIKE 'CC%'), 0) AS ca_engage,
    -COALESCE(SUM(montant_ht) FILTER (WHERE prefix ILIKE 'FC%'), 0) AS ca_constate,
     COALESCE(SUM(montant_ht) FILTER (WHERE prefix ILIKE 'CF%'), 0) AS cogs_engage,
     COALESCE(SUM(montant_ht) FILTER (WHERE prefix ILIKE 'FF%'), 0) AS cogs_constate,
     COUNT(DISTINCT numero_piece) FILTER (WHERE prefix ILIKE 'CC%' OR prefix ILIKE 'CF%') AS nb_commandes,
     COUNT(DISTINCT numero_piece) FILTER (WHERE prefix ILIKE 'FC%' OR prefix ILIKE 'FF%') AS nb_factures
  FROM public.divalto_mouvements_all
  WHERE axe_0001 ILIKE 'M%'
  GROUP BY axe_0001
),
budget AS (
  SELECT spv_affaire_id, SUM(COALESCE(montant_budget_revise, montant_budget)) AS budget_total
  FROM public.spv_affaire_budget_lines GROUP BY spv_affaire_id
)
SELECT
  a.id          AS spv_affaire_id,
  a.code_affaire,
  a.libelle     AS affaire_libelle,
  a.status      AS affaire_status,
  COALESCE(d.ca_engage, 0::numeric)        AS ca_engage_brut,
  COALESCE(d.ca_constate, 0::numeric)      AS ca_constate_brut,
  COALESCE(d.cogs_engage, 0::numeric)      AS cogs_engage_brut,
  COALESCE(d.cogs_constate, 0::numeric)    AS cogs_constate_brut,
  COALESCE(d.ca_constate, 0::numeric) - COALESCE(d.cogs_constate, 0::numeric)                                AS marge_brute,
  COALESCE(d.ca_constate, 0::numeric) - COALESCE(d.cogs_constate, 0::numeric) - COALESCE(t.cout_rh_declare, 0) AS marge_directe,
  COALESCE(d.nb_commandes, 0)              AS nb_commandes,
  COALESCE(d.nb_factures, 0)               AS nb_factures,
  COALESCE(t.jours_declares, 0::numeric)   AS jours_declares,
  COALESCE(t.cout_rh_declare, 0::numeric)  AS cout_rh_declare,
  COALESCE(b.budget_total, 0::numeric)     AS budget_total
FROM public.spv_affaires a
LEFT JOIN div   d ON d.code_affaire = a.code_affaire
LEFT JOIN temps t ON t.code_affaire = a.code_affaire
LEFT JOIN budget b ON b.spv_affaire_id = a.id;
