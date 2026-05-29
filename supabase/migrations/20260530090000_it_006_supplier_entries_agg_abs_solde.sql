-- Migration it_006 : correction signe dans v_it_budget_line_supplier_entries_agg.
--
-- Convention Divalto : solde = +mt si sens=1 (débit), -mt si sens=2 (crédit).
-- Sur un compte fournisseur F* :
--   - facturation entrante : sens=2 (crédit sur F) -> solde NÉGATIF
--   - règlement sortant    : sens=1 (débit sur F)  -> solde POSITIF
--
-- Pour le canon "constaté" (= dépense effective), on veut le montant absolu
-- de chaque écriture rattachée. Sinon, on tombe sur du négatif ou même 0
-- (si l'utilisateur rattache facturation + paiement du même montant).
--
-- Caveat : si un utilisateur rattache à la fois l'écriture de facturation
-- ET son paiement, on double-compte. À traiter côté UX (alerte ou filtre
-- par sens). V1 = abs() simple.

CREATE OR REPLACE VIEW public.v_it_budget_line_supplier_entries_agg AS
SELECT
  l.budget_line_id,
  SUM(ABS(COALESCE(e.solde, 0)) / 1.20)::numeric AS supplier_ht_amount,
  SUM(ABS(COALESCE(e.solde, 0)))::numeric        AS supplier_ttc_amount,
  COUNT(*)::int                                   AS nb_supplier_entries
FROM public.it_budget_line_supplier_entries l
JOIN public.supplier_accounting_entries e ON e.entry_key = l.supplier_entry_key
GROUP BY l.budget_line_id;

GRANT SELECT ON public.v_it_budget_line_supplier_entries_agg TO authenticated;
