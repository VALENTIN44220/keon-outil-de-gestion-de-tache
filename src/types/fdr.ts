// ================================================
// Module Feuille de Route & Plan de Charge — Types
// ================================================

// ---- Référentiels ----

export type StatutPortefeuille =
  | 'Idée'
  | 'Proposition'
  | 'En développement'
  | 'Déployé'
  | 'Tâche permanente'
  | 'Abandonné';

export type CategorieFdr = 'IA' | 'HORS IA';

export const ACTIVITES_METIER = [
  'EXPLOITATION',
  'BUREAU D\'ETUDES',
  'IT/DIGITAL',
  'COMPTA/FINANCE',
  'COMMERCE',
  'JURIDIQUE / ACHAT',
  'RH',
  'DEVELOPPEMENT',
  'COM/MARKETING',
  'DIRECTION / GOUVERNANCE',
  'INNOVATION',
  'TEIKEI',
  'SYCOMORE',
  'TOUS',
] as const;

export type ActiviteMetier = typeof ACTIVITES_METIER[number];

export const STATUT_PORTEFEUILLE_CONFIG: Record<
  StatutPortefeuille,
  { label: string; className: string; color: string }
> = {
  'Idée':              { label: 'Idée',              className: 'bg-slate-100 text-slate-600 border-slate-300',    color: '#94a3b8' },
  'Proposition':       { label: 'Proposition',       className: 'bg-blue-100 text-blue-700 border-blue-300',      color: '#3b82f6' },
  'En développement':  { label: 'En développement',  className: 'bg-violet-100 text-violet-700 border-violet-300', color: '#8b5cf6' },
  'Déployé':           { label: 'Déployé',           className: 'bg-emerald-100 text-emerald-700 border-emerald-300', color: '#10b981' },
  'Tâche permanente':  { label: 'Tâche permanente',  className: 'bg-amber-100 text-amber-700 border-amber-300',   color: '#f59e0b' },
  'Abandonné':         { label: 'Abandonné',         className: 'bg-red-100 text-red-700 border-red-300',         color: '#ef4444' },
};

// ---- Paramètres globaux ----

export interface FdrSettings {
  id: string;
  jours_productifs_mois: number;
  echeance_standard_permanentes: string; // 'YYYY-MM-DD'
  horizon_debut: string;                 // 'YYYY-MM-DD'
  horizon_duree_mois: number;
  created_at: string;
  updated_at: string;
}

// ---- Profils capacitaires ----

export interface FdrProfil {
  id: string;
  nom: string;
  code: string;
  capacite_j_mois: number;
  note?: string | null;
  ordre: number;
  actif: boolean;
  created_at?: string;
  updated_at?: string;
}

// ---- Ventilation charge BUILD par profil ----

export interface ITProjectLoad {
  id: string;
  it_project_id: string;
  profil_id: string;
  j_mois: number;
  profil?: FdrProfil | null;
  created_at?: string;
  updated_at?: string;
}

// ---- Journal des modifications ----

export type FdrChangelogAction =
  | 'move'
  | 'resize'
  | 'remove_fdr'
  | 'restore_fdr'
  | 'change_status'
  | 'change_priority'
  | 'shift_months';

export interface FdrChangelogEntry {
  id: string;
  it_project_id: string;
  user_id?: string | null;
  action: FdrChangelogAction;
  field_changed: string;
  old_value?: string | null;
  new_value?: string | null;
  created_at: string;
  user?: { id: string; display_name: string } | null;
}

// ---- Moteur de calcul — Entrées ----

export interface FdrProjectInput {
  id: string;
  code: string;
  nom: string;
  activite_metier?: string | null;
  profil_principal?: string | null; // code fdr_profils
  statut_portefeuille: StatutPortefeuille;
  sur_feuille_de_route: boolean;
  date_kickoff?: string | null;          // 'YYYY-MM-DD' ou 'YYYY-MM'
  date_mep_saisie?: string | null;       // idem
  delai_projete_mois?: number | null;
  echeance_cible?: string | null;        // idem
  suivi_j_mois: number;
  loads: Array<{ profil_code: string; j_mois: number }>; // build ventilé
  externe: boolean;
  pct_reduction_si_externe: number;      // 0..1
  budget_externe_eur?: number | null;    // coût ST si externalisé (pour ROI scénario)
}

export interface FdrEngineSettings {
  jours_productifs_mois: number;
  echeance_standard_permanentes: string; // 'YYYY-MM'
  horizon_debut: string;                 // 'YYYY-MM'
  horizon_duree_mois: number;
  profils: Array<{ code: string; capacite_j_mois: number }>;
}

// ---- Moteur de calcul — Sorties ----

export interface FdrMonthlyLoad {
  profil_code: string;
  j_mois: number;
}

/** Charge calculée pour un projet sur un mois donné. */
export interface FdrProjectMonthResult {
  project_id: string;
  ym: string; // 'YYYY-MM'
  loads: FdrMonthlyLoad[];
}

export interface FdrProfilCapacityRow {
  profil_code: string;
  capacite: number;
  /** demande j/mois indexée par 'YYYY-MM' */
  demande: Record<string, number>;
  /** écart = capacité − demande, par mois */
  ecart: Record<string, number>;
  /** mois du pic de demande */
  pic: { ym: string; value: number } | null;
}

export interface FdrRsiCascadeRow {
  ym: string;
  sous_effectif_projets: number; // max(0, déficit dev/IA) + max(0, déficit digital)
  appui_rsi: number;             // RSI mobilisé en appui
  sous_effectif_net: number;     // sous_effectif_projets − appui_rsi
  etp_a_recruter: number;        // sous_effectif_net / jours_productifs_mois
}

export interface FdrCapacityMatrix {
  months: string[];                               // horizon complet ['YYYY-MM', ...]
  by_profil: Record<string, FdrProfilCapacityRow>;
  rsi_cascade: FdrRsiCascadeRow[];
}
