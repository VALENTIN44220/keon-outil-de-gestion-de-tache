// ================================================
// Suivi des bugs & demandes d'amélioration — Types
// ================================================

export type BugType = 'bug' | 'amelioration';
export type BugPriority = 'basse' | 'normale' | 'haute' | 'critique';
export type BugStatus = 'nouveau' | 'en_cours' | 'planifie' | 'resolu' | 'rejete' | 'ferme';

export interface BugReportProfile {
  id: string;
  display_name: string | null;
  avatar_url?: string | null;
}

export interface BugReport {
  id: string;
  ref: string | null;
  title: string;
  description: string | null;
  type: BugType;
  priority: BugPriority;
  status: BugStatus;
  page_url: string | null;
  user_agent: string | null;
  reported_by: string | null;
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Joints
  reporter?: BugReportProfile | null;
  assignee?: BugReportProfile | null;
}

export interface BugReportComment {
  id: string;
  bug_report_id: string;
  author_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  author?: BugReportProfile | null;
}

export interface BugReportAttachment {
  id: string;
  bug_report_id: string;
  name: string;
  url: string;
  storage_path: string | null;
  type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface BugReportStatusHistory {
  id: string;
  bug_report_id: string;
  from_status: BugStatus | null;
  to_status: BugStatus;
  changed_by: string | null;
  comment: string | null;
  changed_at: string;
  changer?: BugReportProfile | null;
}

// ---- Configs d'affichage (label + classes badge) ----

export const BUG_TYPE_CONFIG: Record<BugType, { label: string; className: string; icon: string }> = {
  bug:          { label: 'Bug',          className: 'bg-red-500/10 text-red-600 border-red-500/20',     icon: '🐞' },
  amelioration: { label: 'Amélioration', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',  icon: '💡' },
};

export const BUG_PRIORITY_CONFIG: Record<BugPriority, { label: string; className: string }> = {
  basse:    { label: 'Basse',    className: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
  normale:  { label: 'Normale',  className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  haute:    { label: 'Haute',    className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  critique: { label: 'Critique', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
};

export const BUG_STATUS_CONFIG: Record<BugStatus, { label: string; className: string }> = {
  nouveau:  { label: 'Nouveau',  className: 'bg-blue-100 text-blue-700 border-blue-300' },
  en_cours: { label: 'En cours', className: 'bg-amber-100 text-amber-700 border-amber-300' },
  planifie: { label: 'Planifié', className: 'bg-violet-100 text-violet-700 border-violet-300' },
  resolu:   { label: 'Résolu',   className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  rejete:   { label: 'Rejeté',   className: 'bg-red-100 text-red-700 border-red-300' },
  ferme:    { label: 'Fermé',    className: 'bg-slate-100 text-slate-600 border-slate-300' },
};

export const BUG_TYPE_OPTIONS: BugType[] = ['bug', 'amelioration'];
export const BUG_PRIORITY_OPTIONS: BugPriority[] = ['basse', 'normale', 'haute', 'critique'];
export const BUG_STATUS_OPTIONS: BugStatus[] = ['nouveau', 'en_cours', 'planifie', 'resolu', 'rejete', 'ferme'];
