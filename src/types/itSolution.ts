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
  /** URL d'un logo / icône représentant la solution. */
  logo_url?: string | null;
  /** Position du nœud dans la vue graphe (persistée au drag). */
  position_x?: number | null;
  position_y?: number | null;
  /** Taille du nœud dans la vue graphe (persistée au resize). */
  width?: number | null;
  height?: number | null;
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

// ─── Liens entre solutions (cartographie graphe) ────────────────────────

/**
 * Valeurs predefinies pour le type de flux. Le champ accepte aussi des
 * valeurs personnalisees ajoutees via la table it_solution_link_options
 * (le CHECK en DB a ete leve dans la migration 20260503160000).
 */
export type ITSolutionLinkFluxTypePreset =
  | 'data'
  | 'integration'
  | 'fonctionnel'
  | 'technique'
  | 'fichier'
  | 'autre';

/** Texte libre accepte pour autoriser des types personnalises. */
export type ITSolutionLinkFluxType = ITSolutionLinkFluxTypePreset | string;

export type ITSolutionLinkDirection = 'source_to_target' | 'target_to_source' | 'bidirectionnel';

export type ITSolutionLinkEtat =
  | 'a_creer'
  | 'planifie'
  | 'en_developpement'
  | 'en_fonctionnement'
  | 'en_evolution';

export interface ITSolutionLink {
  id: string;
  source_solution_id: string;
  target_solution_id: string;
  type_flux?: ITSolutionLinkFluxType | null;
  direction: ITSolutionLinkDirection;
  protocole?: string | null;
  frequence?: string | null;
  criticite?: ITSolutionCriticite | null;
  /** Cycle de vie du flux. */
  etat_flux?: ITSolutionLinkEtat | null;
  /** Date de mise en service / production effective (format ISO YYYY-MM-DD). */
  date_mise_en_service?: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
}

export const ETAT_FLUX_CONFIG: Record<ITSolutionLinkEtat, { label: string; color: string; className: string }> = {
  a_creer:           { label: 'À créer',           color: '#94a3b8', className: 'bg-slate-100 text-slate-700 border-slate-300' },
  planifie:          { label: 'Planifié',          color: '#0ea5e9', className: 'bg-sky-100 text-sky-700 border-sky-300' },
  en_developpement:  { label: 'En développement',  color: '#f59e0b', className: 'bg-amber-100 text-amber-700 border-amber-300' },
  en_fonctionnement: { label: 'En fonctionnement', color: '#10b981', className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  en_evolution:      { label: 'En évolution',      color: '#8b5cf6', className: 'bg-violet-100 text-violet-700 border-violet-300' },
};

export const FLUX_TYPE_CONFIG: Record<ITSolutionLinkFluxTypePreset, { label: string; color: string; description: string }> = {
  data:        { label: 'Données',          color: '#3b82f6', description: 'Échange de données (ETL, synchronisation)' },
  integration: { label: 'Intégration',      color: '#6366f1', description: 'Intégration applicative (API, webhook)' },
  fonctionnel: { label: 'Fonctionnel',      color: '#8b5cf6', description: 'Dépendance fonctionnelle / métier' },
  technique:   { label: 'Technique',        color: '#0ea5e9', description: 'Dépendance technique (auth, infra)' },
  fichier:     { label: 'Fichier',          color: '#f59e0b', description: 'Échange par fichier (CSV, SFTP)' },
  autre:       { label: 'Autre',            color: '#6b7280', description: 'Autre type de lien' },
};

/**
 * Resout la couleur et le label d'un type de flux : utilise FLUX_TYPE_CONFIG
 * pour les valeurs presetees, fallback sur la valeur brute (et une couleur
 * grise) pour les valeurs personnalisees ajoutees a la volee.
 */
export function resolveFluxType(value: string | null | undefined): { label: string; color: string } {
  if (!value) return { label: '·', color: '#6b7280' };
  const preset = (FLUX_TYPE_CONFIG as Record<string, { label: string; color: string }>)[value];
  if (preset) return { label: preset.label, color: preset.color };
  return { label: value, color: '#6b7280' };
}

export const DIRECTION_LABEL: Record<ITSolutionLinkDirection, { label: string; symbol: string }> = {
  source_to_target:   { label: 'Source → Cible',     symbol: '→' },
  target_to_source:   { label: 'Cible → Source',     symbol: '←' },
  bidirectionnel:     { label: 'Bidirectionnel',     symbol: '↔' },
};

/** Préset de fréquences usuelles (champ texte libre néanmoins). */
export const PRESET_FREQUENCES = [
  'Temps réel',
  'Toutes les heures',
  'Quotidien',
  'Hebdomadaire',
  'Mensuel',
  'À la demande',
] as const;

/** Préset de protocoles usuels (champ texte libre néanmoins). */
export const PRESET_PROTOCOLES = [
  'REST API',
  'GraphQL',
  'Webhook',
  'SFTP / fichier',
  'JDBC / direct DB',
  'CSV / Excel',
  'Bus de messages',
  'Autre',
] as const;
