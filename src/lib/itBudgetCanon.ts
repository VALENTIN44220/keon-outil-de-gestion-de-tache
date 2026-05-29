/**
 * Canon financier d'une ligne budgétaire IT — 4 montants annuels HT :
 *
 *   1. budget_initial  = lineAnnualBudget (somme HT annuelle initiale).
 *   2. budget_revise   = lineAnnualBudgetRevise (reforecast si défini, sinon initial).
 *   3. engage          = somme CF Divalto liées via it_budget_line_commandes,
 *                        OU à défaut le budget annuel si statut = 'engage_total'
 *                        (proxy déclaratif quand la ligne est marquée engagée sans CF).
 *   4. constate        = somme FF Divalto liées via it_budget_line_factures
 *                        + écritures comptables rapprochées (HT estimé à TVA 20%).
 *
 * Hypothèse TVA : 20% (taux standard FR) pour la conversion TTC -> HT des
 * écritures comptables. Approximatif pour les taux 10/5,5/2,1/exempté.
 *
 * Cf. brief utilisateur "MONTANT BUDGET INITIAL / REFORECAST / ENGAGE / CONSTATE".
 */
import type { ITBudgetLine } from '@/types/itProject';
import { lineAnnualBudget, lineAnnualBudgetRevise } from './itBudgetTotals';

export interface BudgetCanonInputs {
  /** Montant des CF Divalto liées (depuis v_it_budget_engage_constate.engage). */
  cf_amount: number;
  /** Montant des FF Divalto liées (depuis v_it_budget_engage_constate.constate). */
  ff_amount: number;
  /** Montant HT estimé des écritures comptables rattachées (depuis v_it_budget_line_supplier_entries_agg). */
  supplier_ht_amount: number;
}

export interface BudgetCanon {
  budget_initial: number;
  budget_revise: number;
  engage: number;
  constate: number;
}

/** Calcule les 4 montants canoniques d'une ligne IT. */
export function computeBudgetCanon(
  line: Pick<
    ITBudgetLine,
    | 'budget_type'
    | 'montant_budget'
    | 'montant_budget_revise'
    | 'statut'
  > & {
    montant_annuel?: number | null;
    budget_type_revise?: string | null;
    mois_budget_revise?: number | null;
  },
  inputs: Partial<BudgetCanonInputs> = {},
): BudgetCanon {
  const budget_initial = lineAnnualBudget(line);
  const budget_revise = lineAnnualBudgetRevise(line);

  const cf = Number(inputs.cf_amount ?? 0);
  const ff = Number(inputs.ff_amount ?? 0);
  const sup = Number(inputs.supplier_ht_amount ?? 0);

  // ENGAGE : CF si dispo, sinon fallback déclaratif statut=engage_total
  const engage = cf > 0
    ? cf
    : (line.statut === 'engage_total' ? budget_revise : 0);

  // CONSTATE : FF Divalto + écritures rapprochées (HT estimé)
  const constate = ff + sup;

  return { budget_initial, budget_revise, engage, constate };
}
