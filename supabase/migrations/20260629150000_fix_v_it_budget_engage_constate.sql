-- =========================================================================
-- Fix vue v_it_budget_engage_constate (engagé / constaté par ligne budgétaire)
--
-- Bug 1 (produit cartésien) : l'ancienne vue joignait commandes ET factures
--   à la même ligne dans une seule requête → une ligne avec N commandes et M
--   factures produisait N×M lignes, donc engagé = Σcommandes×M et
--   constaté = Σfactures×N (ex. NIRWANA : 33 328 ×6 = 199 968).
-- Bug 2 (double source facture) : piece_factures sommait montant_ht de toutes
--   les lignes Divalto (gescom HT + compta TTC) → double comptage. On consolide
--   désormais comme l'app : HT gescom si présent, sinon TTC compta ÷ 1,20.
--
-- Correctif : agréger commandes et factures séparément, dédupliqués par pièce
-- au sein de chaque ligne, puis joindre.
-- =========================================================================
CREATE OR REPLACE VIEW public.v_it_budget_engage_constate AS
WITH piece_commandes AS (
  SELECT numero_piece, sum(montant_ht) AS montant_ht
  FROM public.divalto_mouvements_all
  WHERE doc_type = 'commande'
    AND btrim(COALESCE(numero_piece, '')) <> ALL (ARRAY['', '0'])
  GROUP BY numero_piece
),
piece_factures AS (
  -- Consolidation par pièce : HT gescom prioritaire, sinon TTC compta ÷ 1,20
  SELECT numero_piece,
    COALESCE(
      max(montant_ht) FILTER (WHERE lower(COALESCE(source, '')) = 'gescom'),
      max(montant_ht) FILTER (WHERE lower(COALESCE(source, '')) = 'compta') / 1.20
    ) AS montant_ht
  FROM public.divalto_mouvements_all
  WHERE doc_type = 'facture'
    AND btrim(COALESCE(numero_piece, '')) <> ALL (ARRAY['', '0'])
  GROUP BY numero_piece
),
cmd AS (
  SELECT d.budget_line_id,
         sum(pc.montant_ht) AS engage,
         count(*) AS nb_commandes
  FROM (SELECT DISTINCT budget_line_id, fullcdno
        FROM public.it_budget_line_commandes
        WHERE fullcdno IS NOT NULL) d
  LEFT JOIN piece_commandes pc ON pc.numero_piece = d.fullcdno
  GROUP BY d.budget_line_id
),
fac AS (
  SELECT d.budget_line_id,
         sum(pf.montant_ht) AS constate,
         count(*) AS nb_factures
  FROM (SELECT DISTINCT budget_line_id, fullcdno_fac
        FROM public.it_budget_line_factures
        WHERE fullcdno_fac IS NOT NULL) d
  LEFT JOIN piece_factures pf ON pf.numero_piece = d.fullcdno_fac
  GROUP BY d.budget_line_id
)
SELECT l.id AS budget_line_id,
       l.it_project_id,
       l.annee,
       l.entite,
       l.categorie,
       l.fournisseur_prevu,
       COALESCE(cmd.engage, 0::numeric)   AS engage,
       COALESCE(fac.constate, 0::numeric) AS constate,
       COALESCE(cmd.nb_commandes, 0)      AS nb_commandes,
       COALESCE(fac.nb_factures, 0)       AS nb_factures
FROM public.it_budget_lines l
LEFT JOIN cmd ON cmd.budget_line_id = l.id
LEFT JOIN fac ON fac.budget_line_id = l.id;
