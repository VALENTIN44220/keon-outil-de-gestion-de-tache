import type { ITBudgetLine } from '@/types/itProject';

type BudgetLineLike = Pick<ITBudgetLine, 'budget_type' | 'montant_budget' | 'montant_budget_revise'>;

/**
 * Total budgétaire annuel d'une ligne, en tenant compte de `budget_type` :
 *  - `mensuel` : le montant saisi est mensuel → total annuel = montant × 12
 *  - `annuel`  : le montant saisi est déjà annuel → total = montant
 *
 * Sans cette conversion, toutes les agrégations "Budget total" sous-estiment
 * les lignes mensuelles d'un facteur 12.
 */
export function lineAnnualBudget(line: BudgetLineLike): number {
  const m = line.montant_budget ?? 0;
  return line.budget_type === 'mensuel' ? m * 12 : m;
}

/**
 * Idem mais avec le montant révisé (fallback sur l'initial si non révisé).
 * À utiliser pour tous les KPIs / agrégations / graphes où l'on parle du
 * "budget courant" d'une ligne.
 */
export function lineAnnualBudgetRevise(line: BudgetLineLike): number {
  const m = line.montant_budget_revise ?? line.montant_budget ?? 0;
  return line.budget_type === 'mensuel' ? m * 12 : m;
}
