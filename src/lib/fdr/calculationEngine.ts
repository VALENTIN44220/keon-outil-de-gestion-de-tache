/**
 * Moteur de calcul du plan de charge — Feuille de Route & Plan de Charge
 *
 * Fonction pure, sans dépendances React ni Supabase.
 * Toutes les dates sont manipulées en format 'YYYY-MM' (ex. '2026-06').
 *
 * Règles exactes reprises du modèle Excel FRD 2027-2030 - BUDGET.xlsx
 */

import type {
  FdrProjectInput,
  FdrEngineSettings,
  FdrCapacityMatrix,
  FdrProfilCapacityRow,
  FdrRsiCascadeRow,
  FdrProjectMonthResult,
  FdrMonthlyLoad,
} from '@/types/fdr';

// ---- Utilitaires date YYYY-MM ----

/** Extrait 'YYYY-MM' depuis 'YYYY-MM-DD', 'YYYY-MM' ou null. */
export function toYM(date: string | null | undefined): string | null {
  if (!date) return null;
  const m = date.match(/^(\d{4}-\d{2})/);
  return m ? m[1] : null;
}

/** Génère un tableau de N mois consécutifs à partir de 'YYYY-MM'. */
export function generateHorizon(debut: string, duree: number): string[] {
  const result: string[] = [];
  let [year, month] = debut.split('-').map(Number);
  for (let i = 0; i < duree; i++) {
    result.push(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`);
    month++;
    if (month > 12) { month = 1; year++; }
  }
  return result;
}

/** Ajoute n mois à un 'YYYY-MM'. */
export function addMonths(ym: string, n: number): string {
  let [year, month] = ym.split('-').map(Number);
  month += n;
  while (month > 12) { month -= 12; year++; }
  while (month < 1)  { month += 12; year--; }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

/** Compare deux 'YYYY-MM'. Retourne <0, 0 ou >0. */
export function cmpYM(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---- Moteur principal ----

/**
 * Calcule la charge mensuelle de chaque projet sur l'horizon,
 * puis agrège la matrice capacité par profil.
 */
export function computeCapacityMatrix(
  projects: FdrProjectInput[],
  settings: FdrEngineSettings,
): FdrCapacityMatrix {
  const months = generateHorizon(settings.horizon_debut, settings.horizon_duree_mois);

  // Étape 1 : charge par projet × mois
  const projectResults: FdrProjectMonthResult[] = [];
  for (const p of projects) {
    for (const ym of months) {
      const loads = computeProjectMonthLoads(p, ym, settings);
      projectResults.push({ project_id: p.id, ym, loads });
    }
  }

  // Étape 2 : agrégation demande par profil
  const by_profil: Record<string, FdrProfilCapacityRow> = {};

  for (const { code, capacite_j_mois } of settings.profils) {
    const demande: Record<string, number> = {};
    for (const ym of months) demande[ym] = 0;

    for (const r of projectResults) {
      const load = r.loads.find(l => l.profil_code === code);
      if (load && load.j_mois > 0) {
        demande[r.ym] = (demande[r.ym] ?? 0) + load.j_mois;
      }
    }

    const ecart: Record<string, number> = {};
    let picYm = months[0] ?? '';
    let picVal = 0;
    for (const ym of months) {
      ecart[ym] = capacite_j_mois - demande[ym];
      if (demande[ym] > picVal) { picVal = demande[ym]; picYm = ym; }
    }

    by_profil[code] = {
      profil_code: code,
      capacite: capacite_j_mois,
      demande,
      ecart,
      pic: picVal > 0 ? { ym: picYm, value: picVal } : null,
    };
  }

  // Étape 3 : cascade RSI
  // Ordre impératif (§3 du prompt) :
  //   1. sous_effectif_projets = max(0, déficit dev/IA) + max(0, déficit digital)
  //   2. appui_RSI = min(max(0, capacité_RSI − demande_RSI), sous_effectif_projets)
  //   3. sous_effectif_net = sous_effectif_projets − appui_RSI
  //   4. ETP_a_recruter = sous_effectif_net / jours_productifs_mois
  const rsi_cascade: FdrRsiCascadeRow[] = months.map(ym => {
    const deficit_dev     = Math.max(0, -(by_profil['cp_dev_ia_data']?.ecart[ym] ?? 0));
    const deficit_digital = Math.max(0, -(by_profil['cp_digital']?.ecart[ym] ?? 0));
    const sous_effectif_projets = deficit_dev + deficit_digital;

    const capacite_rsi = by_profil['rsi']?.capacite ?? 0;
    const demande_rsi  = by_profil['rsi']?.demande[ym] ?? 0;
    const dispo_rsi    = Math.max(0, capacite_rsi - demande_rsi);
    const appui_rsi    = Math.min(dispo_rsi, sous_effectif_projets);

    const sous_effectif_net = sous_effectif_projets - appui_rsi;
    const etp_a_recruter    = settings.jours_productifs_mois > 0
      ? sous_effectif_net / settings.jours_productifs_mois
      : 0;

    return { ym, sous_effectif_projets, appui_rsi, sous_effectif_net, etp_a_recruter };
  });

  return { months, by_profil, rsi_cascade };
}

/**
 * Calcule la charge d'un projet pour un seul mois.
 *
 * Règles (§3) :
 *   - Abandonné ou hors FDR → 0
 *   - Tâche permanente      → build_net si kickoff ≤ m ≤ echeance_cible
 *   - Cycle projet          → build_net si kickoff ≤ m < mep_retenue (build)
 *                             suivi si m ≥ mep_retenue (run)
 *   - build_net = Σ j_mois_par_profil × (1 − pct_reduction si externe)
 */
export function computeProjectMonthLoads(
  p: FdrProjectInput,
  ym: string,
  settings: Pick<FdrEngineSettings, 'echeance_standard_permanentes' | 'jours_productifs_mois'>,
): FdrMonthlyLoad[] {
  // Exclu des calculs
  if (p.statut_portefeuille === 'Abandonné' || !p.sur_feuille_de_route) {
    return [];
  }

  const factor = p.externe ? (1 - p.pct_reduction_si_externe) : 1;

  // Charge build d'un profil pour un mois donné :
  //  - profil « détaillé » (months non vide) → valeur du mois (0 = pas démarré / vide)
  //  - sinon → j/mois uniforme
  const buildLoads = (ym: string): FdrMonthlyLoad[] =>
    p.loads
      .map(l => {
        const isDetailed = !!l.months && Object.keys(l.months).length > 0;
        const base = isDetailed ? (l.months![ym] ?? 0) : l.j_mois;
        return { profil_code: l.profil_code, j_mois: base * factor };
      })
      .filter(l => l.j_mois > 0);

  const suiviLoads = (): FdrMonthlyLoad[] => {
    if (!p.profil_principal || p.suivi_j_mois <= 0) return [];
    return [{ profil_code: p.profil_principal, j_mois: p.suivi_j_mois }];
  };

  // ---- Tâche permanente ----
  if (p.statut_portefeuille === 'Tâche permanente') {
    const kickoff = toYM(p.date_kickoff);
    // Échéance : date_mep_saisie ou echeance_cible ou paramètre global
    const echeance =
      toYM(p.date_mep_saisie) ??
      toYM(p.echeance_cible) ??
      settings.echeance_standard_permanentes;

    if (!kickoff) return buildLoads(ym); // pas de date → toujours actif

    if (cmpYM(ym, kickoff) >= 0 && cmpYM(ym, echeance) <= 0) {
      return buildLoads(ym);
    }
    return [];
  }

  // ---- Cycle projet ----
  const kickoff = toYM(p.date_kickoff);
  if (!kickoff || cmpYM(ym, kickoff) < 0) return [];

  // MEP retenue = date_mep_saisie ?? kickoff + delai_projete_mois
  const mepRetenue: string | null =
    toYM(p.date_mep_saisie) ??
    (p.delai_projete_mois != null ? addMonths(kickoff, p.delai_projete_mois) : null);

  if (mepRetenue === null) {
    // Pas de MEP définie → perpetuel build
    return buildLoads(ym);
  }

  if (cmpYM(ym, mepRetenue) < 0) {
    // Phase build : kickoff ≤ m < mep_retenue
    return buildLoads(ym);
  }

  // Phase suivi : m ≥ mep_retenue
  return suiviLoads();
}

/**
 * Calcule la MEP retenue d'un projet (valeur affichée dans l'UI).
 * Renvoie 'YYYY-MM' ou null si les données sont insuffisantes.
 */
export function getMepRetenue(p: FdrProjectInput): string | null {
  if (p.date_mep_saisie) return toYM(p.date_mep_saisie);
  const kickoff = toYM(p.date_kickoff);
  if (kickoff && p.delai_projete_mois != null) {
    return addMonths(kickoff, p.delai_projete_mois);
  }
  return null;
}

/**
 * Calcule la charge totale build nette (toutes profils confondus) d'un projet.
 * Utilisé pour afficher le total de charge induite dans la vue Définition FDR.
 */
export function totalBuildNet(p: FdrProjectInput): number {
  const factor = p.externe ? (1 - p.pct_reduction_si_externe) : 1;
  const isDetailed = (l: FdrProjectInput['loads'][number]) => !!l.months && Object.keys(l.months).length > 0;
  const hasDetailed = p.loads.some(isDetailed);
  if (!hasDetailed) {
    return p.loads.reduce((s, l) => s + l.j_mois, 0) * factor;
  }
  // Pic mensuel = max sur les mois de (Σ profils uniformes + Σ profils détaillés ce mois-là)
  const uniform = p.loads.filter(l => !isDetailed(l)).reduce((s, l) => s + l.j_mois, 0);
  const months = new Set<string>();
  for (const l of p.loads) if (l.months) for (const k of Object.keys(l.months)) months.add(k);
  let peak = uniform;
  for (const ym of months) {
    let s = uniform;
    for (const l of p.loads) if (isDetailed(l)) s += (l.months![ym] ?? 0);
    if (s > peak) peak = s;
  }
  return peak * factor;
}

/**
 * Charge build TOTALE (jours, tous profils) d'un projet sur sa durée.
 *  - profil détaillé : somme des mois saisis.
 *  - profil uniforme : j/mois × delai_projete_mois (ou 0 si délai non renseigné).
 * Le facteur d'externalisation n'est PAS appliqué (charge brute) — appliquez-le à l'appel si besoin.
 */
export function totalBuildDays(p: FdrProjectInput): number {
  const duree = p.delai_projete_mois ?? 0;
  let total = 0;
  for (const l of p.loads) {
    const isDetailed = !!l.months && Object.keys(l.months).length > 0;
    total += isDetailed
      ? Object.values(l.months!).reduce((s, v) => s + (Number(v) || 0), 0)
      : (l.j_mois * duree);
  }
  return total;
}

/**
 * Identifie le mois du pic de demande global (toutes profils confondus).
 * La métrique de dimensionnement est TOUJOURS le PIC (jamais la somme ni la moyenne).
 */
export function globalPeakMonth(matrix: FdrCapacityMatrix): { ym: string; total: number } | null {
  if (matrix.months.length === 0) return null;

  let peakYm = matrix.months[0];
  let peakTotal = 0;

  for (const ym of matrix.months) {
    const total = Object.values(matrix.by_profil)
      .reduce((s, row) => s + (row.demande[ym] ?? 0), 0);
    if (total > peakTotal) { peakTotal = total; peakYm = ym; }
  }

  return { ym: peakYm, total: peakTotal };
}
