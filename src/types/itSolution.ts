// ================================================
// Cartographie IT — Types
// ================================================

export type ITSolutionCriticite = 'faible' | 'moyenne' | 'forte' | 'tres_forte';
export type ITSolutionDatalakeStatus = 'oui' | 'non' | 'indirect' | 'na';
export type ITSolutionLienType =
  | 'creation'
  | 'evolution'
  | 'migration'
  | 'maintenance'
  | 'decommissionnement'
  | 'autre';

export interface ITSolution {
  id: string;
  nom: string;
  /** Catégorie haut-niveau : ERP, TMS, SaaS, Plateforme data, Application métier, etc. */
  categorie?: string | null;
  /** Type technique : Progiciel, SaaS, Système industriel, etc. */
  type?: string | null;
  usage_principal?: string | null;
  domaine_metier?: string | null;
  visible_dans_schema: boolean;
  connecte_datalake?: ITSolutionDatalakeStatus | null;
  flux_principaux?: string | null;
  /** Texte libre décrivant le statut + dates clés (ex: "06/2026 visible sur le schéma"). */
  statut_temporalite?: string | null;
  owner_metier_id?: string | null;
  owner_it_id?: string | null;
  perimetre?: string | null;
  criticite?: ITSolutionCriticite | null;
  commentaires?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  /** Joints au runtime (pas dans la DB elle-même). */
  owner_metier?: { id: string; display_name: string; avatar_url?: string | null } | null;
  owner_it?: { id: string; display_name: string; avatar_url?: string | null } | null;
}

export interface ITSolutionProjectLink {
  solution_id: string;
  project_id: string;
  type_lien?: ITSolutionLienType | null;
  commentaire?: string | null;
  created_at: string;
  created_by?: string | null;
}

/** Valeurs initiales, alignées sur le tableau métier KEON. */
export const PRESET_SOLUTION_CATEGORIES = [
  'ERP',
  'TMS',
  'SaaS',
  'Plateforme data',
  'Application métier',
  'Module métier',
  'Automatisme industriel',
  'SIRH',
  'Finance / consolidation / reporting',
  'Application interne',
  'BI / Reporting',
  'Sources externes',
  'Autre',
] as const;

export const PRESET_SOLUTION_TYPES = [
  'Progiciel',
  'SaaS',
  'Système industriel',
  'Plateforme interne',
  'Données / interfaces externes',
  'Outil de reporting',
  'Module spécifique',
  'Développement interne',
  'Autre',
] as const;

export const CRITICITE_CONFIG: Record<ITSolutionCriticite, { label: string; className: string }> = {
  faible:      { label: 'Faible',      className: 'bg-slate-100 text-slate-700 border-slate-300' },
  moyenne:     { label: 'Moyenne',     className: 'bg-blue-100 text-blue-700 border-blue-300' },
  forte:       { label: 'Forte',       className: 'bg-orange-100 text-orange-700 border-orange-300' },
  tres_forte:  { label: 'Très forte',  className: 'bg-red-100 text-red-700 border-red-300' },
};

export const DATALAKE_CONFIG: Record<ITSolutionDatalakeStatus, { label: string; className: string }> = {
  oui:       { label: 'Connecté',     className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  non:       { label: 'Non connecté', className: 'bg-slate-100 text-slate-700 border-slate-300' },
  indirect:  { label: 'Indirect',     className: 'bg-amber-100 text-amber-700 border-amber-300' },
  na:        { label: 'N/A',          className: 'bg-muted text-muted-foreground border-border' },
};

export const LIEN_TYPE_LABEL: Record<ITSolutionLienType, string> = {
  creation:             'Création',
  evolution:            'Évolution',
  migration:            'Migration',
  maintenance:          'Maintenance',
  decommissionnement:   'Décommissionnement',
  autre:                'Autre',
};
