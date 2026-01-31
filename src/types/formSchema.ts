/**
 * Form Schema Types
 * =================
 * JSONB schema for process form layout, validations, conditions, and UI overrides
 */

import type { ValidationType, ConditionOperator } from './formBuilder';

// =====================
// Schema Version
// =====================

export const FORM_SCHEMA_VERSION = 1;

// =====================
// Section Definition
// =====================

export interface FormSchemaSection {
  id: string;
  name: string;
  label: string;
  description?: string | null;
  columns: 1 | 2 | 3 | 4;
  is_collapsible: boolean;
  is_collapsed_by_default: boolean;
  order_index: number;
  condition?: FormSchemaCondition | null;
}

// =====================
// Field Placement
// =====================

export interface FormSchemaPlacement {
  field_id: string;
  section_id: string;
  column_index: number;
  column_span: 1 | 2 | 3 | 4;
  row_index: number;
  order_index: number;
  overrides: FormSchemaOverrides;
  validation?: FormSchemaValidation | null;
  condition?: FormSchemaCondition | null;
}

// =====================
// UI Overrides
// =====================

export interface FormSchemaOverrides {
  label?: string;
  description?: string | null;
  placeholder?: string | null;
  is_required?: boolean;
  is_readonly?: boolean;
  is_hidden?: boolean;
  default_value?: string | null;
}

// =====================
// Validation Rules
// =====================

export interface FormSchemaValidation {
  type: ValidationType;
  message?: string | null;
  params?: Record<string, any> | null;
}

// =====================
// Conditions
// =====================

export interface FormSchemaCondition {
  field_id: string;
  operator: ConditionOperator;
  value: string | null;
  logic?: 'AND' | 'OR';
  additional?: FormSchemaAdditionalCondition[] | null;
}

export interface FormSchemaAdditionalCondition {
  field_id: string;
  operator: ConditionOperator;
  value: string;
}

// =====================
// Common Fields Config
// =====================

export interface FormSchemaCommonFields {
  requester: boolean;
  company: boolean;
  department: boolean;
  priority: boolean;
  due_date: boolean;
  [key: string]: boolean; // Allow extension
}

export interface FormSchemaCommonFieldOverride {
  field_id: string;
  enabled: boolean;
}

// =====================
// Global Settings
// =====================

export interface FormSchemaGlobalSettings {
  columns: 1 | 2 | 3 | 4;
  show_section_borders: boolean;
  compact_mode: boolean;
  theme?: 'default' | 'cards' | 'minimal';
}

// =====================
// Complete Schema
// =====================

export interface FormSchema {
  version: number;
  sections: FormSchemaSection[];
  placements: FormSchemaPlacement[];
  common_fields: FormSchemaCommonFields;
  common_field_overrides?: FormSchemaCommonFieldOverride[];
  global_settings: FormSchemaGlobalSettings;
}

// =====================
// Default Schema
// =====================

export const DEFAULT_FORM_SCHEMA: FormSchema = {
  version: FORM_SCHEMA_VERSION,
  sections: [
    {
      id: 'default_section',
      name: 'informations',
      label: 'Informations',
      description: null,
      columns: 2,
      is_collapsible: false,
      is_collapsed_by_default: false,
      order_index: 0,
      condition: null,
    },
  ],
  placements: [],
  common_fields: {
    requester: true,
    company: true,
    department: true,
    priority: false,
    due_date: false,
  },
  global_settings: {
    columns: 2,
    show_section_borders: true,
    compact_mode: false,
    theme: 'cards',
  },
};

// =====================
// Helper Functions
// =====================

/**
 * Validates a form schema structure
 */
export function validateFormSchema(schema: any): schema is FormSchema {
  if (!schema || typeof schema !== 'object') return false;
  if (typeof schema.version !== 'number') return false;
  if (!Array.isArray(schema.sections)) return false;
  if (!Array.isArray(schema.placements)) return false;
  if (!schema.common_fields || typeof schema.common_fields !== 'object') return false;
  if (!schema.global_settings || typeof schema.global_settings !== 'object') return false;
  return true;
}

/**
 * Merges a partial schema with defaults
 */
export function mergeWithDefaults(partial: Partial<FormSchema>): FormSchema {
  return {
    ...DEFAULT_FORM_SCHEMA,
    ...partial,
    sections: partial.sections || DEFAULT_FORM_SCHEMA.sections,
    placements: partial.placements || DEFAULT_FORM_SCHEMA.placements,
    common_fields: {
      ...DEFAULT_FORM_SCHEMA.common_fields,
      ...(partial.common_fields || {}),
    },
    global_settings: {
      ...DEFAULT_FORM_SCHEMA.global_settings,
      ...(partial.global_settings || {}),
    },
  };
}

/**
 * Gets placement for a specific field
 */
export function getFieldPlacement(
  schema: FormSchema,
  fieldId: string
): FormSchemaPlacement | undefined {
  return schema.placements.find((p) => p.field_id === fieldId);
}

/**
 * Gets all placements for a section
 */
export function getSectionPlacements(
  schema: FormSchema,
  sectionId: string
): FormSchemaPlacement[] {
  return schema.placements
    .filter((p) => p.section_id === sectionId)
    .sort((a, b) => a.order_index - b.order_index);
}

/**
 * Updates a field placement in the schema
 */
export function updateFieldPlacement(
  schema: FormSchema,
  fieldId: string,
  updates: Partial<FormSchemaPlacement>
): FormSchema {
  const existingIndex = schema.placements.findIndex((p) => p.field_id === fieldId);
  
  if (existingIndex >= 0) {
    const newPlacements = [...schema.placements];
    newPlacements[existingIndex] = { ...newPlacements[existingIndex], ...updates };
    return { ...schema, placements: newPlacements };
  }
  
  return schema;
}

/**
 * Adds a new section to the schema
 */
export function addSection(
  schema: FormSchema,
  section: Omit<FormSchemaSection, 'order_index'>
): FormSchema {
  const maxOrder = Math.max(...schema.sections.map((s) => s.order_index), -1);
  const newSection: FormSchemaSection = {
    ...section,
    order_index: maxOrder + 1,
  };
  return {
    ...schema,
    sections: [...schema.sections, newSection],
  };
}

/**
 * Removes a section and moves its fields to orphan
 */
export function removeSection(schema: FormSchema, sectionId: string): FormSchema {
  return {
    ...schema,
    sections: schema.sections.filter((s) => s.id !== sectionId),
    placements: schema.placements.map((p) =>
      p.section_id === sectionId ? { ...p, section_id: 'default_section' } : p
    ),
  };
}

/**
 * Reorders sections
 */
export function reorderSections(schema: FormSchema, sectionIds: string[]): FormSchema {
  const reorderedSections = sectionIds.map((id, index) => {
    const section = schema.sections.find((s) => s.id === id);
    return section ? { ...section, order_index: index } : null;
  }).filter(Boolean) as FormSchemaSection[];
  
  return { ...schema, sections: reorderedSections };
}
