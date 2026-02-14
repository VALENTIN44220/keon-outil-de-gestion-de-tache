/**
 * Configuration for common/general fields visibility and editability
 * Stored in process_templates.settings JSONB under "common_fields_config"
 */

export interface CommonFieldConfig {
  visible: boolean;
  editable: boolean;
  default_value?: string | null;
}

export interface CommonFieldsConfig {
  title: CommonFieldConfig & {
    /** Pattern for auto-generated title when not editable. Variables: {process}, {date}, {user}, {counter} */
    title_pattern?: string | null;
  };
  description: CommonFieldConfig;
  priority: CommonFieldConfig;
  due_date: CommonFieldConfig;
  be_project: CommonFieldConfig;
}

export const DEFAULT_COMMON_FIELDS_CONFIG: CommonFieldsConfig = {
  title: { visible: true, editable: true, title_pattern: null },
  description: { visible: true, editable: true },
  priority: { visible: true, editable: true, default_value: 'medium' },
  due_date: { visible: true, editable: true },
  be_project: { visible: true, editable: true },
};

export const COMMON_FIELD_LABELS: Record<keyof CommonFieldsConfig, string> = {
  title: 'Titre',
  description: 'Description',
  priority: 'Priorité',
  due_date: 'Échéance',
  be_project: 'Projet associé',
};

/** Available variables for title pattern */
export const TITLE_PATTERN_VARIABLES = [
  { key: '{process}', label: 'Nom du processus' },
  { key: '{date}', label: 'Date (JJ/MM/AAAA)' },
  { key: '{user}', label: 'Nom du demandeur' },
  { key: '{counter}', label: 'Compteur auto' },
];

/**
 * Resolves a title pattern with actual values
 */
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
