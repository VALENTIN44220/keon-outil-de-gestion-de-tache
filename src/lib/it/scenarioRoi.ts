/**
 * ROI agrégé d'un scénario de plan de charge — fonction pure.
 *
 * Agrège, sur les projets que le service peut tenir, les gains et coûts ROI,
 * puis ajoute le coût des renforts du scénario (embauches + sous-traitance
 * générique). Réutilise exactement la même formule projet que `roiCalc`.
 */
import type { FdrProjectInput } from '@/types/fdr';
import type { ITProjectRHHorsIT } from '@/types/itProject';
import type {
  SimulatedHire,
  ScenarioAssumptions,
} from '@/hooks/useFdrHireScenarios';

/** Hypothèses de coût par défaut (si non renseignées dans le scénario). */
export const DEFAULT_ASSUMPTIONS: Required<ScenarioAssumptions> = {
  cout_annuel_etp_embauche: 55_000,
  tjm_st: 500,
};

export interface ScenarioRoi {
  /** Gain annuel cumulé des projets tenables (€/an). */
  gain_annuel_eur: number;
  /** Coût build RH (one-shot) des projets tenables (€). */
  rh_build_eur: number;
  /** COGS = budgets d'externalisation projet (€). */
  cogs_eur: number;
  /** Coût annuel des embauches (€/an, récurrent). */
  cout_embauches_eur: number;
  /** Coût annuel de la sous-traitance générique (€/an). */
  cout_st_eur: number;
  /** Bilan annuel = gain − cogs − build − embauches − ST. */
  bilan_annuel_eur: number;
  /** Temps de retour (ans) ou null si gain nul. */
  temps_retour_an: number | null;
  /** Nombre de projets tenables pris en compte. */
  nb_projets: number;
}

/**
 * @param tenableProjects  projets jugés tenables (overrides déjà appliqués)
 * @param rhHorsITByProject  map it_project_id → lignes RH hors IT
 * @param tjmMap  map profil_code → TJM €/j (référentiel)
 * @param hires  renforts du scénario
 * @param assumptions  hypothèses de coût
 * @param joursProductifsMois  jours productifs / mois (pour valoriser la ST)
 */
export function computeScenarioRoi(
  tenableProjects: FdrProjectInput[],
  rhHorsITByProject: Record<string, ITProjectRHHorsIT[]>,
  tjmMap: Record<string, number>,
  hires: SimulatedHire[],
  assumptions: ScenarioAssumptions,
  joursProductifsMois: number,
): ScenarioRoi {
  const coutEtp = assumptions.cout_annuel_etp_embauche ?? DEFAULT_ASSUMPTIONS.cout_annuel_etp_embauche;
  const tjmSt = assumptions.tjm_st ?? DEFAULT_ASSUMPTIONS.tjm_st;

  let gain_annuel_eur = 0;
  let rh_build_eur = 0;
  let cogs_eur = 0;

  for (const p of tenableProjects) {
    const duree = p.delai_projete_mois ?? 0;
    const rhRows = rhHorsITByProject[p.id] ?? [];

    // COGS = budget externe si externalisé
    if (p.externe) cogs_eur += p.budget_externe_eur ?? 0;

    // RH IT BUILD : j/mois × durée × TJM (sur la charge nette du scénario)
    const factor = p.externe ? 1 - (p.pct_reduction_si_externe ?? 0) : 1;
    for (const l of p.loads) {
      const tjm = tjmMap[l.profil_code] ?? 0;
      rh_build_eur += l.j_mois * factor * duree * tjm;
    }

    // RH HORS IT BUILD + GAIN annuel
    for (const rh of rhRows) {
      if ((rh.j_build ?? 0) > 0) rh_build_eur += (rh.j_build ?? 0) * rh.tjm_interne;
      const joursAn =
        rh.unite === 'jours_an'
          ? rh.jours_an ?? 0
          : (rh.jours_par_spv ?? 0) * (rh.nb_spv ?? 0);
      gain_annuel_eur += joursAn * rh.tjm_interne;
    }
  }

  // Coût des renforts du scénario
  let cout_embauches_eur = 0;
  let cout_st_eur = 0;
  for (const h of hires) {
    const etp = Number(h.nb_etp) || 0;
    if (h.kind === 'sous_traitance') {
      // ST générique valorisée au TJM × jours productifs × 12 mois (annualisé)
      cout_st_eur += etp * joursProductifsMois * 12 * tjmSt;
    } else {
      cout_embauches_eur += etp * coutEtp;
    }
  }

  const bilan_annuel_eur =
    gain_annuel_eur - cogs_eur - rh_build_eur - cout_embauches_eur - cout_st_eur;
  const investissement = cogs_eur + rh_build_eur + cout_embauches_eur + cout_st_eur;
  const temps_retour_an = gain_annuel_eur > 0 ? investissement / gain_annuel_eur : null;

  return {
    gain_annuel_eur,
    rh_build_eur,
    cogs_eur,
    cout_embauches_eur,
    cout_st_eur,
    bilan_annuel_eur,
    temps_retour_an,
    nb_projets: tenableProjects.length,
  };
}
