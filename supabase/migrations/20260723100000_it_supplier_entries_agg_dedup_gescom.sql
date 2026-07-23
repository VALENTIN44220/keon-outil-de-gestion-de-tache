-- Dédoublonnage écriture ↔ facture Divalto dans le constaté par écritures.
-- Une écriture comptable (A1/A2) qui correspond à une facture Divalto DÉJÀ
-- rattachée à la MÊME ligne (même fournisseur + même date + même montant HT)
-- n'est PAS recomptée (sinon double compte : has_gescom_piece n'est pas fiable).
-- Conserve supplier_ht_own (écritures nb_links=1) + filtre journaux A1/A2.
-- Appliqué en prod le 2026-07-23.
CREATE OR REPLACE VIEW public.v_it_budget_line_supplier_entries_agg AS
WITH link_counts AS (
  SELECT supplier_entry_key, count(*)::integer AS nb_links
  FROM it_budget_line_supplier_entries
  GROUP BY supplier_entry_key
),
piece_factures AS (
  SELECT numero_piece,
    COALESCE(
      max(montant_ht) FILTER (WHERE lower(COALESCE(source,'')) = 'gescom'),
      max(montant_ht) FILTER (WHERE lower(COALESCE(source,'')) = 'compta') / 1.20
    ) AS montant_ht,
    max(tiers_code) AS tiers_code,
    max(date_piece) AS date_piece
  FROM divalto_mouvements_all
  WHERE doc_type = 'facture'
    AND btrim(COALESCE(numero_piece,'')) NOT IN ('', '0')
  GROUP BY numero_piece
),
line_factures AS (
  SELECT DISTINCT f.budget_line_id, pf.tiers_code, pf.date_piece, pf.montant_ht
  FROM it_budget_line_factures f
  JOIN piece_factures pf ON pf.numero_piece = f.fullcdno_fac
  WHERE f.fullcdno_fac IS NOT NULL
)
SELECT l.budget_line_id,
  sum(abs(COALESCE(e.solde, 0::numeric)) / 1.20 / lc.nb_links::numeric) AS supplier_ht_amount,
  sum(abs(COALESCE(e.solde, 0::numeric)) / lc.nb_links::numeric) AS supplier_ttc_amount,
  count(*)::integer AS nb_supplier_entries,
  sum(abs(COALESCE(e.solde, 0::numeric)) / 1.20) FILTER (WHERE lc.nb_links = 1) AS supplier_ht_own,
  sum(abs(COALESCE(e.solde, 0::numeric)))        FILTER (WHERE lc.nb_links = 1) AS supplier_ttc_own
FROM it_budget_line_supplier_entries l
JOIN supplier_accounting_entries e ON e.entry_key = l.supplier_entry_key
JOIN link_counts lc ON lc.supplier_entry_key = l.supplier_entry_key
WHERE e.journal IN ('A1','A2')
  AND NOT EXISTS (
    SELECT 1 FROM line_factures lf
    WHERE lf.budget_line_id = l.budget_line_id
      AND lf.tiers_code = e.supplier_code
      AND lf.date_piece = e.date
      AND round(lf.montant_ht) = round(abs(COALESCE(e.solde,0)) / 1.20)
  )
GROUP BY l.budget_line_id;
