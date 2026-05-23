-- SPV budget v4 : classification par CODE TIERS (universel, couvre les pièces
-- sans préfixe). Divalto : tiers 'C…' = client (CA), 'F…' = fournisseur (COGS).
-- Vérifié 100% cohérent avec le préfixe quand il existe + récupère les pièces
-- à préfixe NULL (notamment ~10,3M€ de factures client M auparavant exclues).
--   CA   = tiers C, montant inversé (stocké négatif en base)
--   COGS = tiers F, montant tel quel
--   engagé = doc_type 'commande' ; constaté = doc_type 'facture'

CREATE OR REPLACE VIEW public.v_spv_affaire_budget_kpi AS
WITH temps AS (
  SELECT code_affaire, jours_declares, cout_rh_declare FROM public.v_spv_affaire_temps_kpi
),
div AS (
  SELECT
    axe_0001 AS code_affaire,
    -COALESCE(SUM(montant_ht) FILTER (WHERE tiers_code ILIKE 'C%' AND doc_type = 'commande'), 0) AS ca_engage,
    -COALESCE(SUM(montant_ht) FILTER (WHERE tiers_code ILIKE 'C%' AND doc_type = 'facture'),  0) AS ca_constate,
     COALESCE(SUM(montant_ht) FILTER (WHERE tiers_code ILIKE 'F%' AND doc_type = 'commande'), 0) AS cogs_engage,
     COALESCE(SUM(montant_ht) FILTER (WHERE tiers_code ILIKE 'F%' AND doc_type = 'facture'),  0) AS cogs_constate,
     COUNT(*) FILTER (WHERE doc_type = 'commande') AS nb_commandes,
     COUNT(*) FILTER (WHERE doc_type = 'facture')  AS nb_factures
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
