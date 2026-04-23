// ================================================
// IT Project Types — Module Projets Digitaux
// ================================================

export type ITProjectType =
  | 'infrastructure'
  | 'applicatif'
  | 'securite'
  | 'data'
  | 'integration'
  | 'autre';

export type ITProjectPriority = 'critique' | 'haute' | 'normale' | 'basse';

export type ITProjectStatus =
  | 'backlog'
  | 'en_cours'
  | 'recette'
  | 'deploye'
  | 'cloture'
  | 'suspendu';

export type ITProjectPhase =
  | 'cadrage'
  | 'analyse'
  | 'developpement'
  | 'recette'
  | 'deploiement';

export type ITProjectPilier = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

export type MilestoneStatus = 'a_venir' | 'en_cours' | 'termine' | 'retarde';

export type StatutFDR =
  | 'non_soumis'
  | 'en_cours_validation'
  | 'abandonne'
  | 'fdr_2026'
  | 'fdr_2027'
  | 'fdr_2030'
  | 'stand_by'
  | 'inclus_autre_projet';

export const STATUT_FDR_CONFIG: Record<StatutFDR, { label: string; className: string; icon: string }> = {
  non_soumis: { label: 'Non soumis', icon: '⬜', className: 'bg-slate-100 text-slate-600 border-slate-300' },
  en_cours_validation: { label: 'En cours de validation', icon: '🔄', className: 'bg-blue-100 text-blue-700 border-blue-300' },
  abandonne: { label: 'Abandonné', icon: '❌', className: 'bg-red-100 text-red-700 border-red-300' },
  fdr_2026: { label: 'Feuille de Route 2026', icon: '📅', className: 'bg-teal-100 text-teal-700 border-teal-300' },
  fdr_2027: { label: 'Feuille de Route 2027', icon: '✅', className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  fdr_2030: { label: 'Feuille de Route 2030', icon: '🎯', className: 'bg-violet-100 text-violet-700 border-violet-300' },
  stand_by: { label: 'Mis en stand-by', icon: '⏸️', className: 'bg-amber-100 text-amber-700 border-amber-300' },
  inclus_autre_projet: { label: 'Inclus dans un autre projet IT', icon: '🔗', className: 'bg-cyan-100 text-cyan-700 border-cyan-300' },
};

export interface ITProjectFDRValidation {
  id: string;
  it_project_id: string;
  etape: number;
  etape_label: string;
  statut: 'a_faire' | 'en_cours' | 'valide' | 'rejete';
  date_validation?: string | null;
  valideur_id?: string | null;
  commentaire?: string | null;
  valideur?: { id: string; display_name: string } | null;
}

export const FDR_ETAPES = [
  { numero: 1, label: 'Expression de besoin', icon: '📋' },
  { numero: 2, label: 'Estimation budget & délais', icon: '💰' },
  { numero: 3, label: 'Présentation au CODIR', icon: '👔' },
  { numero: 4, label: 'Arbitrage & validation', icon: '✅' },
];

export interface ITProject {
  id: string;
  code_projet_digital: string;
  nom_projet: string;
  description?: string | null;
  type_projet?: ITProjectType | null;
  priorite?: ITProjectPriority | null;
  statut: ITProjectStatus;
  phase_courante?: ITProjectPhase | null;

  // Équipe
  responsable_it_id?: string | null;
  chef_projet_id?: string | null;
  sponsor_id?: string | null;
  company_id?: string | null;
  chef_projet_metier_id?: string | null;
  chef_projet_it_id?: string | null;
  groupe_service_id?: string | null;
  directeur_id?: string | null;
  membres_ids?: string[];

  // Pilier & FDR
  pilier?: ITProjectPilier | null;
  fdr_priorite?: string | null;
  fdr_type?: string | null;
  fdr_description?: string | null;
  fdr_commentaires?: string | null;

  // Dates
  date_debut?: string | null;
  date_fin_prevue?: string | null;
  date_fin_reelle?: string | null;

  // Budget
  budget_previsionnel?: number | null;
  budget_consomme?: number | null;

  // Avancement
  progress?: number;

  // Microsoft sync (liens directs)
  teams_channel_id?: string | null;
  teams_channel_url?: string | null;
  loop_workspace_id?: string | null;
  loop_workspace_url?: string | null;

  // Metadata
  created_at: string;
  updated_at: string;
  created_by?: string | null;

  // FDR governance
  statut_fdr?: StatutFDR | null;
  etape_validation_fdr?: number | null;

  // Joined data (optional, for display)
  responsable_it?: { id: string; display_name: string; avatar_url?: string | null } | null;
  chef_projet?: { id: string; display_name: string; avatar_url?: string | null } | null;
  sponsor?: { id: string; display_name: string; avatar_url?: string | null } | null;
  company?: { id: string; name: string } | null;
  chef_projet_metier?: { id: string; display_name: string; avatar_url?: string | null } | null;
  chef_projet_it?: { id: string; display_name: string; avatar_url?: string | null } | null;
  groupe_service?: { id: string; name: string } | null;
  directeur?: { id: string; display_name: string; avatar_url?: string | null } | null;
}

export interface ITProjectMilestone {
  id: string;
  it_project_id: string;
  titre: string;
  description?: string | null;
  phase?: ITProjectPhase | null;
  date_prevue?: string | null;
  date_reelle?: string | null;
  statut: MilestoneStatus;
  ordre: number;
  created_at: string;
  updated_at: string;
}

export interface ITProjectSyncLog {
  id: string;
  it_project_id: string;
  sync_type: 'teams_notification' | 'loop_update';
  status: 'success' | 'error';
  payload?: Record<string, unknown>;
  error_message?: string | null;
  created_at: string;
}

// Labels de statut
export const IT_PROJECT_STATUS_CONFIG: Record<
  ITProjectStatus,
  { label: string; className: string; color: string }
> = {
  backlog: {
    label: 'Backlog',
    className: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
    color: '#64748b',
  },
  en_cours: {
    label: 'En cours',
    className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    color: '#3b82f6',
  },
  recette: {
    label: 'Recette',
    className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    color: '#f59e0b',
  },
  deploye: {
    label: 'Déployé',
    className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    color: '#10b981',
  },
  cloture: {
    label: 'Clôturé',
    className: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    color: '#6b7280',
  },
  suspendu: {
    label: 'Suspendu',
    className: 'bg-red-500/10 text-red-600 border-red-500/20',
    color: '#ef4444',
  },
};

export const IT_PROJECT_TYPE_CONFIG: Record<ITProjectType, { label: string; icon: string }> = {
  infrastructure: { label: 'Infrastructure', icon: '🖧' },
  applicatif: { label: 'Applicatif', icon: '💻' },
  securite: { label: 'Sécurité', icon: '🔒' },
  data: { label: 'Data / BI', icon: '📊' },
  integration: { label: 'Intégration', icon: '🔗' },
  autre: { label: 'Autre', icon: '📦' },
};

export const IT_PROJECT_PRIORITY_CONFIG: Record<
  ITProjectPriority,
  { label: string; className: string }
> = {
  critique: { label: 'Critique', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
  haute: { label: 'Haute', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  normale: { label: 'Normale', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  basse: { label: 'Basse', className: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
};

export const IT_PROJECT_PHASES: { value: ITProjectPhase; label: string; order: number }[] = [
  { value: 'cadrage', label: 'Cadrage / Expression de besoin', order: 1 },
  { value: 'analyse', label: 'Analyse & Conception', order: 2 },
  { value: 'developpement', label: 'Développement / Intégration', order: 3 },
  { value: 'recette', label: 'Recette / Tests', order: 4 },
  { value: 'deploiement', label: 'Déploiement / MEP', order: 5 },
];

export const IT_PHASE_BADGE_CONFIG: Record<ITProjectPhase, { label: string; className: string }> = {
  cadrage: { label: 'Cadrage', className: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
  analyse: { label: 'Analyse', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  developpement: { label: 'Développement', className: 'bg-violet-500/10 text-violet-600 border-violet-500/20' },
  recette: { label: 'Recette', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  deploiement: { label: 'Déploiement', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
};

export const IT_PROJECT_PILIER_CONFIG: Record<
  ITProjectPilier,
  { label: string; description: string; color: string; className: string }
> = {
  P1: { label: 'Humains & compétences', description: 'Capital humain, formation, montée en compétences', color: '#3b82f6', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  P2: { label: 'Données / IA / décision', description: 'Data, intelligence artificielle, aide à la décision', color: '#8b5cf6', className: 'bg-violet-500/10 text-violet-600 border-violet-500/20' },
  P3: { label: 'Process & outils', description: 'Optimisation des processus, outillage métier', color: '#f59e0b', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  P4: { label: 'Résilience & sécurité', description: 'Cybersécurité, continuité d\'activité, résilience', color: '#ef4444', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
  P5: { label: 'Durabilité & sobriété', description: 'RSE numérique, sobriété énergétique, green IT', color: '#10b981', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
};

// Exemple de code généré automatiquement : NSK_IT-00001

// ================================================
// Budget IT — Types
// ================================================

export type BudgetLineStatut =
  | 'brouillon' | 'valide' | 'engage_partiel' | 'engage_total'
  | 'facture_partiel' | 'facture_total' | 'clos' | 'anomalie';

export type TypeDepense = 'Opex' | 'Capex' | 'RH' | 'Amortissement';

export const BUDGET_LINE_STATUT_CONFIG: Record<BudgetLineStatut, { label: string; className: string }> = {
  brouillon:       { label: 'Brouillon',          className: 'bg-slate-100 text-slate-600 border-slate-300' },
  valide:          { label: 'Validé',             className: 'bg-green-100 text-green-700 border-green-300' },
  engage_partiel:  { label: 'Engagé partiel',     className: 'bg-blue-100 text-blue-700 border-blue-300' },
  engage_total:    { label: 'Engagé total',       className: 'bg-blue-200 text-blue-800 border-blue-400' },
  facture_partiel: { label: 'Facturé partiel',    className: 'bg-violet-100 text-violet-700 border-violet-300' },
  facture_total:   { label: 'Facturé total',      className: 'bg-violet-200 text-violet-800 border-violet-400' },
  clos:            { label: 'Clos',               className: 'bg-gray-100 text-gray-500 border-gray-300' },
  anomalie:        { label: 'Anomalie',           className: 'bg-red-100 text-red-700 border-red-300' },
};

export type BudgetType = 'mensuel' | 'annuel';

export interface ITBudgetLine {
  id: string;
  it_project_id: string;
  exercice: number;
  version: string;
  categorie?: string | null;
  sous_categorie?: string | null;
  fournisseur_prevu?: string | null;
  type_depense?: TypeDepense | null;
  nature_depense?: string | null;
  description?: string | null;
  /**
   * Type de budget :
   * - 'mensuel' : le même montant est affecté à chaque mois
   * - 'annuel'  : le montant est décaissé sur le mois `mois_budget`
   */
  budget_type: BudgetType;
  /** Mois de décaissement (1-12) utilisé quand budget_type = 'annuel'. */
  mois_budget?: number | null;
  montant_budget: number;
  montant_budget_revise?: number | null;
  statut: BudgetLineStatut;
  mode_saisie: 'import' | 'manuel';
  commentaire?: string | null;
  external_key?: string | null;
  created_at: string;
  updated_at: string;
}

export type ITBudgetOptionType = 'categorie' | 'sous_categorie' | 'nature_depense';

export interface ITBudgetOption {
  id: string;
  option_type: ITBudgetOptionType;
  value: string;
  parent_value?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface ITManualExpense {
  id: string;
  it_budget_line_id?: string | null;
  it_project_id?: string | null;
  entite?: string | null;
  annee?: number | null;
  categorie?: string | null;
  sous_categorie?: string | null;
  fournisseur_prevu?: string | null;
  type_depense?: TypeDepense | null;
  nature_depense?: string | null;
  source_depense?: 'divalto' | 'note_de_frais' | 'autre' | string | null;
  mode_decaissement?: 'annuel' | 'mensuel' | string | null;
  mois_applicables?: number[] | null;
  type_prevision: 'depense_prevue' | 'provision' | 'refacturation' | 'correction' | 'exceptionnel';
  date_prevue?: string | null;
  fournisseur?: string | null;
  description?: string | null;
  montant_prevu: number;
  statut: 'en_attente' | 'confirme' | 'annule';
  commentaire?: string | null;
  created_at: string;
  updated_at: string;
}

/** Montant budgété annuel équivalent (mensuel × nb mois applicables, ou 12 si mois non renseignés). */
export function itManualExpenseAnnualEquivalent(
  e: Pick<ITManualExpense, 'montant_prevu' | 'mode_decaissement' | 'mois_applicables'>,
): number {
  const m = e.montant_prevu ?? 0;
  if (e.mode_decaissement === 'mensuel') {
    const n = e.mois_applicables?.length ? e.mois_applicables.length : 12;
    return m * n;
  }
  return m;
}

export const MANUAL_EXPENSE_SOURCE_LABEL: Record<string, string> = {
  divalto: 'Divalto',
  note_de_frais: 'Note de frais',
  autre: 'Autre',
};

export const MANUAL_EXPENSE_MODE_LABEL: Record<string, string> = {
  annuel: 'Annuel',
  mensuel: 'Mensuel',
};

export interface ITBudgetReallocation {
  id: string;
  it_project_id: string;
  from_budget_line_id?: string | null;
  to_budget_line_id?: string | null;
  montant: number;
  motif?: string | null;
  statut_validation: 'en_attente' | 'valide' | 'rejete';
  decided_by?: string | null;
  decided_at?: string | null;
  created_at: string;
}

export interface ITBudgetKPIs {
  budget_initial: number;
  budget_revise: number;
  engage: number;         // Phase 2 : CFK Divalto
  constate: number;       // Phase 2 : FFK Divalto
  reste_a_engager: number;
  reste_a_constater: number;
  forecast_fin_annee: number;
  ecart_budget: number;
  montant_reaffectable: number;
  depassement: number;
  taux_consommation: number;
}

// ================================================
// Budget Global IT — Types complémentaires
// ================================================

// @deprecated — utiliser useCompanies() pour la liste des entités. Conservé pour compat types.
export const IT_ENTITES = ['KEON', 'Sycomore', 'Fluxo', 'TADD', 'Autre'] as const;
export type ITEntite = typeof IT_ENTITES[number];

export const IT_BUDGET_ANNEES = [2024, 2025, 2026, 2027] as const;
export type ITBudgetAnnee = typeof IT_BUDGET_ANNEES[number];

export interface ITBudgetGlobalFilters {
  annee: number;
  entite: string;
  type_depense: string;
  categorie: string;
}

// ================================================
// IT Budget — Préférences utilisateur
// ================================================

export interface ITBudgetColumnsConfig {
  /** Clés des colonnes visibles, dans l'ordre */
  order: string[];
  /** Clés des colonnes masquées */
  hidden: string[];
}

export interface ITBudgetFiltersConfig {
  annee?: number;
  entite?: string;
  type_depense?: string;
  categorie?: string;
  sous_categorie?: string;
  fournisseur_prevu?: string;
  statut?: string;
  mois_budget?: string;
  projet_it?: string;
  search?: string;
}

export interface ITBudgetUserPreferences {
  columns_config: ITBudgetColumnsConfig;
  filters_config: ITBudgetFiltersConfig;
}
