import type { ITBudgetLine } from '@/types/itProject';

type BudgetLineLike = Pick<ITBudgetLine, 'budget_type' | 'montant_budget' | 'montant_budget_revise'> & {
  montant_annuel?: number | null;
  budget_type_revise?: string | null;
  mois_budget_revise?: number | null;
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
 * Total annuel reforcaste : utilise budget_type_revise si defini, sinon
 * fallback sur budget_type initial. Si aucun montant_budget_revise n'est
 * defini, on tombe sur l'annuel initial.
 */
export function lineAnnualBudgetRevise(line: BudgetLineLike): number {
  // Type effectif pour le revise (peut differer de l'initial)
  const effectiveType = line.budget_type_revise || line.budget_type;

  // Si pas de revision saisie : on retourne l'initial calcule
  if (line.montant_budget_revise == null) {
    return lineAnnualBudget(line);
  }

  if (effectiveType === 'mensuel_variable') {
    // En mensuel_variable revise, montant_budget_revise contient deja la somme annuelle
    return Number(line.montant_budget_revise);
  }
  if (effectiveType === 'mensuel') {
    return Number(line.montant_budget_revise) * 12;
  }
  // annuel : montant_budget_revise est le montant annuel direct
  return Number(line.montant_budget_revise);
}
