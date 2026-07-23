-- Le constaté issu des écritures comptables ne doit compter que les FACTURES
-- achats (journaux A1/A2). On exclut règlements (banques BQ*, BNP…), reports
-- (RAN, REP) et OD : ce ne sont pas des dépenses « constatées » côté budget.
-- Appliqué en prod le 2026-07-23.
CREATE OR REPLACE VIEW public.v_it_budget_line_supplier_entries_agg AS
WITH link_counts AS (
  SELECT supplier_entry_key, count(*)::integer AS nb_links
  FROM it_budget_line_supplier_entries
  GROUP BY supplier_entry_key
)
SELECT l.budget_line_id,
  sum(abs(COALESCE(e.solde, 0::numeric)) / 1.20 / lc.nb_links::numeric) AS supplier_ht_amount,
  sum(abs(COALESCE(e.solde, 0::numeric)) / lc.nb_links::numeric) AS supplier_ttc_amount,
  count(*)::integer AS nb_supplier_entries
FROM it_budget_line_supplier_entries l
JOIN supplier_accounting_entries e ON e.entry_key = l.supplier_entry_key
JOIN link_counts lc ON lc.supplier_entry_key = l.supplier_entry_key
WHERE e.journal IN ('A1','A2')
GROUP BY l.budget_line_id;
