/**
 * Calcul ROI d'un projet IT — fonction pure (sans React/Supabase).
 * Extrait de ITProjectROITab pour être réutilisé par l'agrégat scénario.
 */
import type { ITProject, ITProjectRHHorsIT, ITRoiCalc } from '@/types/itProject';
import type { ITProjectLoad } from '@/types/fdr';

export function computeRoi(
  project: Pick<ITProject, 'budget_externe_eur' | 'delai_projete_mois'>,
  loads: ITProjectLoad[],
  tjmMap: Record<string, number>,
  rhHorsIT: ITProjectRHHorsIT[],
): ITRoiCalc {
  // COGS = budget externe (coût si ST)
  const cogs_eur = project.budget_externe_eur ?? 0;

  // RH IT BUILD : j/mois × durée build × TJM
  const duree = project.delai_projete_mois ?? 0;
  let rh_it_eur = 0;
  let total_j_build = 0;
  for (const load of loads) {
    const code = load.profil?.code ?? '';
    const tjm = tjmMap[code] ?? 0;
    const jBuild = load.j_mois * duree;
    total_j_build += jBuild;
    rh_it_eur += jBuild * tjm;
  }

  // RH HORS IT BUILD : j_build × tjm_interne (ex : chef de projet métier)
  for (const rh of rhHorsIT) {
    if ((rh.j_build ?? 0) > 0) {
      rh_it_eur += (rh.j_build ?? 0) * rh.tjm_interne;
      total_j_build += rh.j_build ?? 0;
    }
  }

  // GAIN = économies ETP hors IT valorisées (annuelles post-déploiement)
  let gain_annuel_eur = 0;
  for (const rh of rhHorsIT) {
    let joursAn = 0;
    if (rh.unite === 'jours_an') {
      joursAn = rh.jours_an ?? 0;
    } else {
      joursAn = (rh.jours_par_spv ?? 0) * (rh.nb_spv ?? 0);
    }
    gain_annuel_eur += joursAn * rh.tjm_interne;
  }

  const bilan_annuel_eur = gain_annuel_eur - cogs_eur - rh_it_eur;
  const investissement = cogs_eur + rh_it_eur;
  const temps_retour_an = gain_annuel_eur > 0 ? investissement / gain_annuel_eur : null;

  return { cogs_eur, rh_it_eur, gain_annuel_eur, bilan_annuel_eur, temps_retour_an, total_j_build };
}
