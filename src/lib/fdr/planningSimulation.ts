/**
 * Simulation d'embauches sur le plan de charge — fonctions pures (overlay
 * capacité + recalcul de la cascade RSI). Aucune dépendance React/Supabase.
 */
import type { FdrCapacityMatrix, FdrProjectInput, FdrEngineSettings } from '@/types/fdr';
import type { SimulatedHire, ProjectOverride } from '@/hooks/useFdrHireScenarios';
import { computeProjectMonthLoads } from './calculationEngine';

export interface AdjustedProfilRow {
  code: string;
  capaciteBase: number;
  demande: Record<string, number>;
  /** Capacité ajoutée par les renforts simulés (j/mois), par mois — total. */
  addedCap: Record<string, number>;
  /** Capacité ajoutée par les embauches internes (j/mois), par mois. */
  addedEmbauche: Record<string, number>;
  /** Capacité ajoutée par la sous-traitance externe (j/mois), par mois. */
  addedSousTraitance: Record<string, number>;
  /** Écart ajusté = (capaciteBase + addedCap) − demande. */
  ecart: Record<string, number>;
  /** Sous-effectif = max(0, −écart) (j/mois), par mois. */
  deficit: Record<string, number>;
}

export interface AdjustedCascadeRow {
  ym: string;
  sous_effectif_projets: number;
  appui_rsi: number;
  sous_effectif_net: number;
  etp_a_recruter: number;
}

export interface AdjustedMatrix {
  months: string[];
  by_profil: Record<string, AdjustedProfilRow>;
  cascade: AdjustedCascadeRow[];
}

/**
 * Applique des embauches simulées : +nb_etp × jours_productifs_mois j/mois de
 * capacité sur le profil choisi, à partir de son mois de début, puis recalcule
 * l'écart par profil et la cascade RSI selon la même logique que le moteur.
 */
export function applyHires(
  matrix: Pick<FdrCapacityMatrix, 'months' | 'by_profil'>,
  hires: SimulatedHire[],
  joursProductifsMois: number,
): AdjustedMatrix {
  const months = matrix.months;
  const by_profil: Record<string, AdjustedProfilRow> = {};

  for (const code of Object.keys(matrix.by_profil)) {
    const base = matrix.by_profil[code];
    const addedCap: Record<string, number> = {};
    const addedEmbauche: Record<string, number> = {};
    const addedSousTraitance: Record<string, number> = {};
    const ecart: Record<string, number> = {};
    const deficit: Record<string, number> = {};
    for (const ym of months) {
      let emb = 0;
      let sst = 0;
      for (const h of hires) {
        if (h.profil_code !== code || ym < h.start_ym) continue;
        const j = (Number(h.nb_etp) || 0) * joursProductifsMois;
        if (h.kind === 'sous_traitance') sst += j; else emb += j;
      }
      addedEmbauche[ym] = emb;
      addedSousTraitance[ym] = sst;
      addedCap[ym] = emb + sst;
      ecart[ym] = base.capacite + emb + sst - (base.demande[ym] ?? 0);
      deficit[ym] = Math.max(0, -ecart[ym]);
    }
    by_profil[code] = { code, capaciteBase: base.capacite, demande: base.demande, addedCap, addedEmbauche, addedSousTraitance, ecart, deficit };
  }

  const cascade: AdjustedCascadeRow[] = months.map((ym) => {
    const deficit_dev = Math.max(0, -(by_profil['cp_dev_ia_data']?.ecart[ym] ?? 0));
    const deficit_digital = Math.max(0, -(by_profil['cp_digital']?.ecart[ym] ?? 0));
    const sous_effectif_projets = deficit_dev + deficit_digital;

    const capRsi = (by_profil['rsi']?.capaciteBase ?? 0) + (by_profil['rsi']?.addedCap[ym] ?? 0);
    const demRsi = by_profil['rsi']?.demande[ym] ?? 0;
    const dispo = Math.max(0, capRsi - demRsi);
    const appui_rsi = Math.min(dispo, sous_effectif_projets);

    const sous_effectif_net = sous_effectif_projets - appui_rsi;
    const etp_a_recruter = joursProductifsMois > 0 ? sous_effectif_net / joursProductifsMois : 0;
    return { ym, sous_effectif_projets, appui_rsi, sous_effectif_net, etp_a_recruter };
  });

  return { months, by_profil, cascade };
}

/**
 * Applique les overrides d'un scénario aux inputs projets (dates de lancement,
 * externalisation par projet). Fonction pure : ne modifie pas les inputs
 * d'origine. Seuls les champs présents dans l'override sont remplacés ;
 * les champs absents conservent la valeur du projet.
 */
export function applyProjectOverrides(
  inputs: FdrProjectInput[],
  overrides: ProjectOverride[],
): FdrProjectInput[] {
  if (!overrides.length) return inputs;
  const byId = new Map(overrides.map((o) => [o.it_project_id, o]));
  return inputs.map((p) => {
    const o = byId.get(p.id);
    if (!o) return p;
    return {
      ...p,
      date_kickoff: o.date_kickoff !== undefined ? o.date_kickoff : p.date_kickoff,
      date_mep_saisie: o.date_mep_saisie !== undefined ? o.date_mep_saisie : p.date_mep_saisie,
      externe: o.externe !== undefined ? o.externe : p.externe,
      pct_reduction_si_externe:
        o.pct_reduction_si_externe !== undefined
          ? o.pct_reduction_si_externe
          : p.pct_reduction_si_externe,
      budget_externe_eur:
        o.budget_externe_eur !== undefined ? o.budget_externe_eur : p.budget_externe_eur,
    };
  });
}

export interface ProjectClassification {
  /** Projets dont la fenêtre build ne génère aucune surcharge (écart simulé ≥ 0). */
  tenable: FdrProjectInput[];
  /** Projets dont au moins un profil mobilisé est en surcharge sur la fenêtre build. */
  aRisque: FdrProjectInput[];
}

/**
 * Classe les projets selon que le service peut les tenir, sur la base de la
 * matrice ajustée du scénario.
 *
 * Heuristique : un projet est **tenable** si, sur tous les mois où il est actif
 * (build), tous les profils qu'il mobilise restent en écart simulé ≥ 0. Si un
 * profil mobilisé est en surcharge sur un de ces mois → **à risque**.
 *
 * Les projets hors feuille de route ou abandonnés (aucun mois actif) sont ignorés.
 */
export function classifyProjects(
  inputs: FdrProjectInput[],
  adjusted: AdjustedMatrix,
  settings: Pick<FdrEngineSettings, 'echeance_standard_permanentes' | 'jours_productifs_mois'>,
): ProjectClassification {
  const tenable: FdrProjectInput[] = [];
  const aRisque: FdrProjectInput[] = [];

  for (const p of inputs) {
    let active = false;
    let risky = false;
    for (const ym of adjusted.months) {
      const loads = computeProjectMonthLoads(p, ym, settings);
      if (loads.length === 0) continue;
      active = true;
      for (const l of loads) {
        const ecart = adjusted.by_profil[l.profil_code]?.ecart[ym];
        if (ecart !== undefined && ecart < 0) { risky = true; break; }
      }
      if (risky) break;
    }
    if (!active) continue;
    (risky ? aRisque : tenable).push(p);
  }

  return { tenable, aRisque };
}

/** Pic (max) d'une série mensuelle sur les mois d'une période → { ym, value }. */
export function peakOver(values: Record<string, number>, periodMonths: string[]): { ym: string; value: number } {
  let ym = periodMonths[0] ?? '';
  let value = -Infinity;
  for (const m of periodMonths) {
    const v = values[m] ?? 0;
    if (v > value) { value = v; ym = m; }
  }
  return { ym, value: value === -Infinity ? 0 : value };
}

/** Pic ETP à recruter sur tout l'horizon (métrique de dimensionnement). */
export function peakEtp(cascade: { etp_a_recruter: number }[]): number {
  return cascade.reduce((mx, r) => Math.max(mx, r.etp_a_recruter), 0);
}
