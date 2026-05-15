/**
 * Types & constantes du module SMQ — Non-Conformités (NC)
 *
 * Reproduit fidèlement les listes de valeurs du formulaire SharePoint
 * KEONGROUP > QUALITE_NC-AC, nettoyées des doublons et placeholders.
 */

// ─── Statut workflow d'une NC ────────────────────────────────────────────
export type NCStatus = 'nouvelle' | 'affectee' | 'en_cours' | 'cloturee';

export const NC_STATUS_META: Record<NCStatus, { label: string; color: string; icon?: string }> = {
  nouvelle:  { label: 'Nouvelle',  color: 'bg-slate-100 text-slate-700 border-slate-300' },
  affectee:  { label: 'Affectée',  color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  en_cours:  { label: 'En cours',  color: 'bg-amber-100 text-amber-700 border-amber-300' },
  cloturee:  { label: 'Levée / Terminée', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
};

// ─── Identification (5 valeurs) ──────────────────────────────────────────
export type NCIdentification =
  | 'points_vigilance'
  | 'nc_qualite'
  | 'axe_amelioration'
  | 'nc_fournisseur'
  | 'incident_site';

export const NC_IDENTIFICATION_LABELS: Record<NCIdentification, string> = {
  points_vigilance:  'Points de vigilance',
  nc_qualite:        'Non-Conformité Qualité',
  axe_amelioration:  'Axe d\'amélioration',
  nc_fournisseur:    'Non-conformité fournisseur',
  incident_site:     'Incident site',
};

// ─── Apparition possible ailleurs ────────────────────────────────────────
export type NCApparition = 'oui' | 'non' | 'ne_sais_pas' | 'non_concerne';

export const NC_APPARITION_LABELS: Record<NCApparition, string> = {
  oui:           'Oui',
  non:           'Non',
  ne_sais_pas:   'Ne sais pas',
  non_concerne:  'Non concerné',
};

// ─── Efficacité de l'action ──────────────────────────────────────────────
export type NCEfficacite = 'efficace' | 'a_ameliorer' | 'inefficace';

export const NC_EFFICACITE_LABELS: Record<NCEfficacite, string> = {
  efficace:     'Efficace',
  a_ameliorer:  'À améliorer',
  inefficace:   'Inefficace',
};

// ─── Processus (13 valeurs SharePoint, alignées sur la cartographie) ────
export interface NCProcessus { code: string; label: string; category: 'operationnel' | 'support' | 'management' }

export const NC_PROCESSUS: NCProcessus[] = [
  { code: 'P-Op1',  label: 'P-Op1 : Vendre - Commerce',                                   category: 'operationnel' },
  { code: 'P-Op2',  label: 'P-Op2 : Développer - Investir',                               category: 'operationnel' },
  { code: 'P-Op3',  label: 'P-Op3 : Concevoir - Dimensionner (BE Nsk)',                  category: 'operationnel' },
  { code: 'P-Op4',  label: 'P-Op4 : Réaliser - Construire',                               category: 'operationnel' },
  { code: 'P-Op5',  label: 'P-Op5 : Assister (labo, maintenance, pièces…)',              category: 'operationnel' },
  { code: 'P-Op6',  label: 'P-Op6 : Exploiter - Produire',                                category: 'operationnel' },
  { code: 'P-Sup1', label: 'P-Sup1 : Management de la Qualité',                           category: 'support' },
  { code: 'P-Sup2', label: 'P-Sup2 : Management des Ressources Humaines',                 category: 'support' },
  { code: 'P-Sup3', label: 'P-Sup3 : Communication - Marketing',                          category: 'support' },
  { code: 'P-Sup4', label: 'P-Sup4 : Gestion des documents et de l\'information',         category: 'support' },
  { code: 'P-Sup5', label: 'P-Sup5 : Achats et Comptabilité',                             category: 'support' },
  { code: 'P-Sup6', label: 'P-Sup6 : Innover et développer',                              category: 'support' },
  { code: 'P-Man1', label: 'P-Man1 : Management de la direction',                         category: 'management' },
];

// ─── Métier (29 valeurs, "Choix 30" supprimé car placeholder) ────────────
export const NC_METIERS: string[] = [
  'COMMERCE',
  'DEVELOPPEMENT',
  'EXPORT',
  'REGLEMENTATION',
  'ETUDE BE',
  'ETUDE MOE',
  'CONSTRUCTION',
  'MOE-Chantier',
  'EXECUTION',
  'MISE EN SERVICE',
  'MAINTENANCE',
  'LABORATOIRE',
  'PIECES',
  'EXPLOITATION',
  'ASTREINTE',
  'APPROVISIONNEMENT',
  'RH',
  'RH GROUPE',
  'RH SPV',
  'COMPTABILITE',
  'CONTROLE DE GESTION',
  'SERVICES GENERAUX',
  'ACHAT',
  'QUALITE - ISO - QUALIMETHA',
  'SECURITE',
  'CONTROLE-AUDIT',
  'SERVEUR-INFORMATIQUE-WEB',
  'COMMUNICATION - MARKETING',
  'R&D',
  'Nouveaux business',
];

// ─── Sociétés du groupe (14 valeurs SharePoint) ──────────────────────────
export const NC_SOCIETES: string[] = [
  'KEON',
  'NASKEO',
  'SYCOMORE',
  'TERGREEN',
  'KEON.BIO',
  'TEIKEI',
  'DOLE',
  'LES 3 DOMES',
  'AUNIS BIOGAZ',
  'CERES',
  'ELEMANTERRE',
  'AKENE 45',
  'NASKEO KANKYO',
  'NASKEO QUEBEC',
];

// ─── Type d'action (corrective / préventive) ─────────────────────────────
export type NCActionType = 'corrective' | 'preventive';
export const NC_ACTION_TYPE_LABELS: Record<NCActionType, string> = {
  corrective: 'Corrective (court terme)',
  preventive: 'Préventive (éviter le retour)',
};

export type NCActionStatus = 'todo' | 'in_progress' | 'done';
export const NC_ACTION_STATUS_LABELS: Record<NCActionStatus, string> = {
  todo:        'À faire',
  in_progress: 'En cours',
  done:        'Terminée',
};

// ─── Interfaces DB ───────────────────────────────────────────────────────
export interface NCDeclaration {
  id: string;
  nc_number: string | null;
  title: string;
  description_problem: string | null;
  date_constat: string;
  date_cloture_souhaitee: string | null;
  declarant_id: string | null;
  pilote_id: string | null;
  processus_code: string | null;
  metier_code: string | null;
  societe_code: string | null;
  identification: NCIdentification | null;
  apparition_ailleurs: NCApparition | null;
  fournisseur_nom: string | null;
  code_projet: string | null;
  causes_racines: string | null;
  actions_correctives: string | null;
  actions_preventives: string | null;
  status: NCStatus;
  efficacite_action: NCEfficacite | null;
  cloturee_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface NCAttachment {
  id: string;
  nc_id: string;
  name: string;
  url: string;
  type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface NCStatusHistory {
  id: string;
  nc_id: string;
  from_status: NCStatus | null;
  to_status: NCStatus;
  changed_by: string | null;
  comment: string | null;
  changed_at: string;
}

export interface NCProcessPilot {
  processus_code: string;
  pilote_id: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface NCAction {
  id: string;
  nc_id: string;
  type: NCActionType;
  title: string;
  description: string | null;
  assignee_id: string | null;
  due_date: string | null;
  status: NCActionStatus;
  linked_task_id: string | null;
  done_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
