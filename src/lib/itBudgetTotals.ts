import type { ITBudgetLine } from '@/types/itProject';

type BudgetLineLike = Pick<ITBudgetLine, 'budget_type' | 'montant_budget' | 'montant_budget_revise'> & {
  montant_annuel?: number | null;
};

/**
 * Total budgétaire annuel d'une ligne, en tenant compte de `budget_type` :
 *  - `mensuel`           : le montant saisi est mensuel → total annuel = montant × 12
 *  - `mensuel_variable`  : 12 montants distincts → on lit `montant_annuel` (somme déjà persistée)
 *  - `annuel`            : le montant saisi est déjà annuel → total = montant
 */
export function lineAnnualBudget(line: BudgetLineLike): number {
  if (line.budget_type === 'mensuel_variable') {
    return Number(line.montant_annuel ?? 0);
  }
  const m = line.montant_budget ?? 0;
  return line.budget_type === 'mensuel' ? m * 12 : m;
}

/**
 * Idem mais avec le montant révisé (fallback sur l'initial si non révisé).
 */
export function lineAnnualBudgetRevise(line: BudgetLineLike): number {
  if (line.budget_type === 'mensuel_variable') {
    return Number(line.montant_annuel ?? 0);
  }
  const m = line.montant_budget_revise ?? line.montant_budget ?? 0;
  return line.budget_type === 'mensuel' ? m * 12 : m;
}
