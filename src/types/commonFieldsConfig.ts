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
  title: CommonFieldConfig;
  description: CommonFieldConfig;
  priority: CommonFieldConfig;
  due_date: CommonFieldConfig;
  be_project: CommonFieldConfig;
}

export const DEFAULT_COMMON_FIELDS_CONFIG: CommonFieldsConfig = {
  title: { visible: true, editable: true },
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
