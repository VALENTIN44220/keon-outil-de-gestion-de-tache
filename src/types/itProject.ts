export type ITProjectType = 'infrastructure' | 'applicatif' | 'securite' | 'data' | 'integration' | 'autre';
export type ITProjectPriority = 'critique' | 'haute' | 'normale' | 'basse';
export type ITProjectStatus = 'backlog' | 'en_cours' | 'recette' | 'deploye' | 'cloture' | 'suspendu';
export type ITProjectPhase = 'cadrage' | 'analyse' | 'developpement' | 'recette' | 'deploiement';
export type MilestoneStatus = 'a_venir' | 'en_cours' | 'termine' | 'retarde';

export interface ITProject {
  id: string;
  code_projet_digital: string;
  nom_projet: string;
  description?: string | null;
  type_projet?: ITProjectType | null;
  priorite?: ITProjectPriority | null;
  statut: ITProjectStatus;
  phase_courante?: ITProjectPhase | null;
  responsable_it_id?: string | null;
  chef_projet_id?: string | null;
  sponsor_id?: string | null;
  membres_ids?: string[];
  date_debut?: string | null;
  date_fin_prevue?: string | null;
  date_fin_reelle?: string | null;
  budget_previsionnel?: number | null;
  budget_consomme?: number | null;
  progress?: number;
  teams_channel_id?: string | null;
  teams_channel_url?: string | null;
  loop_workspace_id?: string | null;
  loop_workspace_url?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  responsable_it?: { id: string; display_name: string; avatar_url?: string | null } | null;
  chef_projet?: { id: string; display_name: string; avatar_url?: string | null } | null;
  sponsor?: { id: string; display_name: string; avatar_url?: string | null } | null;
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

export const IT_PROJECT_STATUS_CONFIG: Record<ITProjectStatus, { label: string; className: string; color: string }> = {
  backlog:   { label: 'Backlog',    className: 'bg-slate-500/10 text-slate-600 border-slate-500/20',   color: '#64748b' },
  en_cours:  { label: 'En cours',   className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',     color: '#3b82f6' },
  recette:   { label: 'Recette',    className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',   color: '#f59e0b' },
  deploye:   { label: 'Déployé',    className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', color: '#10b981' },
  cloture:   { label: 'Clôturé',    className: 'bg-gray-500/10 text-gray-500 border-gray-500/20',     color: '#6b7280' },
  suspendu:  { label: 'Suspendu',   className: 'bg-red-500/10 text-red-600 border-red-500/20',        color: '#ef4444' },
};

export const IT_PROJECT_TYPE_CONFIG: Record<ITProjectType, { label: string; icon: string }> = {
  infrastructure: { label: 'Infrastructure', icon: '🖧' },
  applicatif:     { label: 'Applicatif',     icon: '💻' },
  securite:       { label: 'Sécurité',       icon: '🔒' },
  data:           { label: 'Data / BI',      icon: '📊' },
  integration:    { label: 'Intégration',    icon: '🔗' },
  autre:          { label: 'Autre',          icon: '📦' },
};

export const IT_PROJECT_PRIORITY_CONFIG: Record<ITProjectPriority, { label: string; className: string }> = {
  critique: { label: 'Critique', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
  haute:    { label: 'Haute',    className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  normale:  { label: 'Normale',  className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  basse:    { label: 'Basse',    className: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
};

export const IT_PROJECT_PHASES: { value: ITProjectPhase; label: string; order: number }[] = [
  { value: 'cadrage',       label: 'Cadrage / Expression de besoin', order: 1 },
  { value: 'analyse',       label: 'Analyse & Conception',           order: 2 },
  { value: 'developpement', label: 'Développement / Intégration',    order: 3 },
  { value: 'recette',       label: 'Recette / Tests',                order: 4 },
  { value: 'deploiement',   label: 'Déploiement / MEP',             order: 5 },
];
