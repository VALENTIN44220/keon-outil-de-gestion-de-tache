/**
 * Configuration des champs visibles lors de la création d'une demande.
 * Stocké dans process_templates.settings JSONB sous "common_fields_config".
 *
 * Les champs correspondent aux 3 grands flux de l'application :
 *  - Flux générique (NewRequestDialog) : title, description, category, priority,
 *    due_date, target_department, attachments
 *  - Flux BE (NewBERequestDialog)      : be_project, be_affaire, be_urgency,
 *    description, due_date, attachments
 *  - Flux IT (générique + IT)          : it_project, it_project_phase
 */

export interface CommonFieldConfig {
  visible: boolean;
  editable: boolean;
  default_value?: string | null;
}

export interface CommonFieldsConfig {
  // ─── Champs communs à tous les flux ────────────────────────────────────────
  title: CommonFieldConfig & {
    /** Pattern de génération auto. Variables : {process}, {date}, {user}, {counter} */
    title_pattern?: string | null;
  };
  description: CommonFieldConfig;
  priority: CommonFieldConfig;
  due_date: CommonFieldConfig;
  attachments: CommonFieldConfig;

  // ─── Flux générique ────────────────────────────────────────────────────────
  category: CommonFieldConfig;
  target_department: CommonFieldConfig;

  // ─── Flux Bureau d'Études ──────────────────────────────────────────────────
  be_project: CommonFieldConfig;
  be_affaire: CommonFieldConfig;
  be_urgency: CommonFieldConfig;

  // ─── Flux IT / Digital ─────────────────────────────────────────────────────
  it_project: CommonFieldConfig;
  it_project_phase: CommonFieldConfig;
}

export const DEFAULT_COMMON_FIELDS_CONFIG: CommonFieldsConfig = {
  // Communs
  title: { visible: true, editable: false, title_pattern: '{process} - {date}' },
  description: { visible: true, editable: true },
  priority: { visible: true, editable: true, default_value: 'medium' },
  due_date: { visible: true, editable: true },
  attachments: { visible: true, editable: true },

  // Générique
  category: { visible: false, editable: true },
  target_department: { visible: true, editable: true },

  // BE
  be_project: { visible: false, editable: true },
  be_affaire: { visible: false, editable: true },
  // Urgence choisie par le demandeur (visible + éditable) — défaut 'normal'
  be_urgency: { visible: true, editable: true, default_value: 'normal' },

  // IT
  it_project: { visible: false, editable: true },
  it_project_phase: { visible: false, editable: true },
};

/**
 * Deep-merge d'une config partielle depuis la DB avec les valeurs par défaut.
 * Indispensable pour rester rétrocompatible avec les configs existantes en DB
 * qui ne contiennent que les anciens champs.
 */
export function mergeCommonFieldsConfig(
  override?: Partial<CommonFieldsConfig> | null
): CommonFieldsConfig {
  if (!override) return { ...DEFAULT_COMMON_FIELDS_CONFIG };
  const keys = Object.keys(DEFAULT_COMMON_FIELDS_CONFIG) as (keyof CommonFieldsConfig)[];
  const result: any = {};
  for (const key of keys) {
    result[key] = {
      ...DEFAULT_COMMON_FIELDS_CONFIG[key],
      ...(override[key] || {}),
    };
  }
  return result as CommonFieldsConfig;
}

export const COMMON_FIELD_LABELS: Record<keyof CommonFieldsConfig, string> = {
  // Communs
  title: 'Titre',
  description: 'Description',
  priority: 'Priorité',
  due_date: 'Échéance',
  attachments: 'Pièces jointes',
  // Générique
  category: 'Catégorie',
  target_department: 'Service cible',
  // BE
  be_project: 'Projet BE',
  be_affaire: 'Affaire BE',
  be_urgency: 'Urgence BE',
  // IT
  it_project: 'Projet IT',
  it_project_phase: 'Phase projet IT',
};

/**
 * Regroupement des champs par flux pour l'affichage dans l'admin.
 * Chaque groupe a un label, une couleur, et la liste de ses champs.
 */
export type FieldFlow = 'common' | 'generic' | 'be' | 'it';

export const FIELD_FLOW_GROUPS: Array<{
  flow: FieldFlow;
  label: string;
  description: string;
  fields: (keyof CommonFieldsConfig)[];
}> = [
  {
    flow: 'common',
    label: 'Champs communs',
    description: 'Présents dans tous les flux (générique, BE, IT)',
    fields: ['title', 'description', 'priority', 'due_date', 'attachments'],
  },
  {
    flow: 'generic',
    label: 'Flux générique',
    description: 'Pour les demandes hors BE/IT',
    fields: ['category', 'target_department'],
  },
  {
    flow: 'be',
    label: 'Flux Bureau d\'Études',
    description: 'Spécifique aux prestations BE (projet, affaire, urgence)',
    fields: ['be_project', 'be_affaire', 'be_urgency'],
  },
  {
    flow: 'it',
    label: 'Flux IT / Digital',
    description: 'Spécifique aux demandes IT (projet et phase)',
    fields: ['it_project', 'it_project_phase'],
  },
];

/** Variables disponibles pour le pattern de titre */
export const TITLE_PATTERN_VARIABLES = [
  { key: '{process}', label: 'Nom du processus' },
  { key: '{date}', label: 'Date (JJ/MM/AAAA)' },
  { key: '{user}', label: 'Nom du demandeur' },
  { key: '{counter}', label: 'Compteur auto' },
];

/** Résout un pattern de titre avec des valeurs réelles */
export function resolveTitlePattern(
  pattern: string,
  context: {
    processName?: string;
    userName?: string;
    counter?: number;
  }
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR');

  return pattern
    .replace(/\{process\}/g, context.processName || '')
    .replace(/\{date\}/g, dateStr)
    .replace(/\{user\}/g, context.userName || '')
    .replace(/\{counter\}/g, String(context.counter ?? 1).padStart(3, '0'));
}
