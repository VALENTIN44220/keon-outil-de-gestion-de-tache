-- Migration it_005 : vue d'agrégation des écritures comptables rattachées
-- par ligne budgétaire IT. Utilisée pour calculer le canon CONSTATÉ
-- (= FF Divalto + écritures comptables rapprochées, en HT estimé à 20%).
CREATE OR REPLACE VIEW public.v_it_budget_line_supplier_entries_agg AS
SELECT
  l.budget_line_id,
  SUM(COALESCE(e.solde, 0) / 1.20)::numeric AS supplier_ht_amount,
  SUM(COALESCE(e.solde, 0))::numeric        AS supplier_ttc_amount,
  COUNT(*)::int                              AS nb_supplier_entries
FROM public.it_budget_line_supplier_entries l
JOIN public.supplier_accounting_entries e ON e.entry_key = l.supplier_entry_key
GROUP BY l.budget_line_id;

GRANT SELECT ON public.v_it_budget_line_supplier_entries_agg TO authenticated;
