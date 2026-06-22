-- =========================================================================
-- IT Budget — nouveau budget_type 'annuel_multi'
-- =========================================================================
-- Montant annuel décaissé sur PLUSIEURS mois choisis (échéancier), par
-- opposition à 'annuel' (décaissement unique sur mois_budget).
-- Le stockage par mois réutilise it_budget_line_months (comme mensuel_variable) ;
-- montant_annuel porte la somme annuelle → le canon (lineAnnualBudget) reste
-- inchangé puisqu'il lit montant_annuel.
-- =========================================================================

ALTER TABLE public.it_budget_lines
  DROP CONSTRAINT IF EXISTS it_budget_lines_budget_type_check;
ALTER TABLE public.it_budget_lines
  ADD CONSTRAINT it_budget_lines_budget_type_check
  CHECK (budget_type = ANY (ARRAY['mensuel'::text, 'mensuel_variable'::text, 'annuel'::text, 'annuel_multi'::text]));

ALTER TABLE public.it_budget_lines
  DROP CONSTRAINT IF EXISTS it_budget_lines_budget_type_revise_check;
ALTER TABLE public.it_budget_lines
  ADD CONSTRAINT it_budget_lines_budget_type_revise_check
  CHECK (budget_type_revise IS NULL OR budget_type_revise = ANY (ARRAY['mensuel'::text, 'mensuel_variable'::text, 'annuel'::text, 'annuel_multi'::text]));

COMMENT ON COLUMN public.it_budget_lines.budget_type IS
  'mensuel = même montant chaque mois ; mensuel_variable = 12 montants distincts ; annuel = décaissement unique (mois_budget) ; annuel_multi = montant annuel réparti sur plusieurs mois (échéancier dans it_budget_line_months)';
