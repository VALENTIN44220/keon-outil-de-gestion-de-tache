// Form Builder Types
// ==================

import type { TemplateCustomField, CustomFieldType } from './customField';

// =====================
// Validation Types
// =====================

export type ValidationType = 
  | 'phone_fr'
  | 'phone_intl'
  | 'siret'
  | 'siren'
  | 'email'
  | 'url'
  | 'iban'
  | 'postal_code_fr'
  | 'regex'
  | 'min_length'
  | 'max_length'
  | 'min_value'
  | 'max_value'
  | 'date_range'
  | 'required_if'
  | 'unique';

export interface ValidationRule {
  type: ValidationType;
  params?: Record<string, any>;
  message?: string;
}

export const VALIDATION_TYPE_LABELS: Record<ValidationType, string> = {
  phone_fr: 'Téléphone français',
  phone_intl: 'Téléphone international',
  siret: 'SIRET',
  siren: 'SIREN',
  email: 'Email',
  url: 'URL',
  iban: 'IBAN',
  postal_code_fr: 'Code postal FR',
  regex: 'Expression régulière',
  min_length: 'Longueur minimum',
  max_length: 'Longueur maximum',
  min_value: 'Valeur minimum',
  max_value: 'Valeur maximum',
  date_range: 'Plage de dates',
  required_if: 'Requis si...',
  unique: 'Valeur unique',
};

export const VALIDATION_TYPE_ICONS: Record<ValidationType, string> = {
  phone_fr: 'Phone',
  phone_intl: 'Globe',
  siret: 'Building2',
  siren: 'Building',
  email: 'Mail',
  url: 'Link',
  iban: 'CreditCard',
  postal_code_fr: 'MapPin',
  regex: 'Regex',
  min_length: 'ArrowLeftToLine',
  max_length: 'ArrowRightToLine',
  min_value: 'ArrowDown',
  max_value: 'ArrowUp',
  date_range: 'Calendar',
  required_if: 'CircleDot',
  unique: 'Fingerprint',
};

// Validation regex patterns
export const VALIDATION_PATTERNS: Record<string, RegExp> = {
  phone_fr: /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/,
  phone_intl: /^\+?[1-9]\d{1,14}$/,
  siret: /^\d{14}$/,
  siren: /^\d{9}$/,
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  url: /^https?:\/\/[^\s/$.?#].[^\s]*$/,
  iban: /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/,
  postal_code_fr: /^\d{5}$/,
};

// =====================
// Form Section Types
// =====================

export interface FormSection {
  id: string;
  name: string;
  label: string;
  description: string | null;
  process_template_id: string | null;
  sub_process_template_id: string | null;
  is_common: boolean;
  is_collapsible: boolean;
  is_collapsed_by_default: boolean;
  order_index: number;
  condition_field_id: string | null;
  condition_operator: ConditionOperator | null;
  condition_value: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ConditionOperator = 
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'not_empty'
  | 'in_list'
  | 'not_in_list';

export const CONDITION_OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'Est égal à',
  not_equals: 'N\'est pas égal à',
  contains: 'Contient',
  not_contains: 'Ne contient pas',
  starts_with: 'Commence par',
  ends_with: 'Se termine par',
  greater_than: 'Supérieur à',
  less_than: 'Inférieur à',
  is_empty: 'Est vide',
  not_empty: 'N\'est pas vide',
  in_list: 'Est dans la liste',
  not_in_list: 'N\'est pas dans la liste',
};

// =====================
// Extended Field Type with layout
// =====================

export interface FormField extends TemplateCustomField {
  // Layout properties
  section_id: string | null;
  column_span: number;
  row_index: number | null;
  column_index: number;
  width_ratio: number | null;
  
  // Enhanced validation
  validation_type: ValidationType | null;
  validation_message: string | null;
  validation_params: Record<string, any> | null;
  
  // Advanced conditions
  conditions_logic: 'AND' | 'OR';
  additional_conditions: FieldCondition[] | null;
}

export interface FieldCondition {
  field_id: string;
  operator: ConditionOperator;
  value: string;
}

// =====================
// Form Builder State
// =====================

export interface FormBuilderState {
  sections: FormSection[];
  fields: FormField[];
  selectedSectionId: string | null;
  selectedFieldId: string | null;
  isDragging: boolean;
  previewMode: boolean;
  zoom: number;
}

export type FormBuilderAction =
  | { type: 'SET_SECTIONS'; payload: FormSection[] }
  | { type: 'SET_FIELDS'; payload: FormField[] }
  | { type: 'SELECT_SECTION'; payload: string | null }
  | { type: 'SELECT_FIELD'; payload: string | null }
  | { type: 'ADD_SECTION'; payload: FormSection }
  | { type: 'UPDATE_SECTION'; payload: Partial<FormSection> & { id: string } }
  | { type: 'DELETE_SECTION'; payload: string }
  | { type: 'ADD_FIELD'; payload: FormField }
  | { type: 'UPDATE_FIELD'; payload: Partial<FormField> & { id: string } }
  | { type: 'DELETE_FIELD'; payload: string }
  | { type: 'MOVE_FIELD'; payload: { fieldId: string; targetSectionId: string | null; targetIndex: number } }
  | { type: 'REORDER_SECTIONS'; payload: string[] }
  | { type: 'SET_DRAGGING'; payload: boolean }
  | { type: 'TOGGLE_PREVIEW'; payload?: boolean }
  | { type: 'SET_ZOOM'; payload: number };

// =====================
// Field Type Configuration
// =====================

export interface FieldTypeConfig {
  type: CustomFieldType;
  label: string;
  icon: string;
  category: 'basic' | 'advanced' | 'lookup' | 'special';
  description: string;
  defaultProps?: Partial<FormField>;
  allowedValidations?: ValidationType[];
}

export const FIELD_TYPE_CONFIGS: FieldTypeConfig[] = [
  // Basic fields
  {
    type: 'text',
    label: 'Texte court',
    icon: 'Type',
    category: 'basic',
    description: 'Champ de texte simple sur une ligne',
    allowedValidations: ['min_length', 'max_length', 'regex', 'email', 'url', 'phone_fr', 'phone_intl', 'postal_code_fr'],
  },
  {
    type: 'textarea',
    label: 'Texte long',
    icon: 'AlignLeft',
    category: 'basic',
    description: 'Zone de texte multi-lignes',
    allowedValidations: ['min_length', 'max_length'],
  },
  {
    type: 'number',
    label: 'Nombre',
    icon: 'Hash',
    category: 'basic',
    description: 'Valeur numérique',
    allowedValidations: ['min_value', 'max_value', 'siret', 'siren'],
  },
  {
    type: 'date',
    label: 'Date',
    icon: 'Calendar',
    category: 'basic',
    description: 'Sélecteur de date',
    allowedValidations: ['date_range'],
  },
  {
    type: 'datetime',
    label: 'Date et heure',
    icon: 'Clock',
    category: 'basic',
    description: 'Sélecteur de date avec heure',
    allowedValidations: ['date_range'],
  },
  {
    type: 'checkbox',
    label: 'Case à cocher',
    icon: 'CheckSquare',
    category: 'basic',
    description: 'Option oui/non',
  },
  
  // Advanced fields
  {
    type: 'select',
    label: 'Liste déroulante',
    icon: 'ChevronDown',
    category: 'advanced',
    description: 'Sélection unique parmi des options',
  },
  {
    type: 'multiselect',
    label: 'Liste multiple',
    icon: 'ListChecks',
    category: 'advanced',
    description: 'Sélection multiple parmi des options',
  },
  {
    type: 'email',
    label: 'Email',
    icon: 'Mail',
    category: 'advanced',
    description: 'Champ email avec validation',
    defaultProps: { validation_type: 'email' },
  },
  {
    type: 'phone',
    label: 'Téléphone',
    icon: 'Phone',
    category: 'advanced',
    description: 'Numéro de téléphone',
    defaultProps: { validation_type: 'phone_fr' },
  },
  {
    type: 'url',
    label: 'URL',
    icon: 'Link',
    category: 'advanced',
    description: 'Adresse web',
    defaultProps: { validation_type: 'url' },
  },
  
  // Lookup fields
  {
    type: 'user_search',
    label: 'Utilisateur',
    icon: 'UserSearch',
    category: 'lookup',
    description: 'Sélection d\'un utilisateur',
  },
  {
    type: 'department_search',
    label: 'Service',
    icon: 'Building2',
    category: 'lookup',
    description: 'Sélection d\'un service',
  },
  {
    type: 'table_lookup',
    label: 'Liste depuis table',
    icon: 'Database',
    category: 'lookup',
    description: 'Valeurs depuis une table de données',
  },
  
  // Special fields
  {
    type: 'file',
    label: 'Fichier',
    icon: 'Paperclip',
    category: 'special',
    description: 'Upload de fichier',
  },
];

// =====================
// Helpers
// =====================

export function getFieldsBySection(
  fields: FormField[],
  sectionId: string | null
): FormField[] {
  return fields
    .filter((f) => f.section_id === sectionId)
    .sort((a, b) => {
      if (a.row_index !== b.row_index) {
        return (a.row_index ?? 0) - (b.row_index ?? 0);
      }
      return a.column_index - b.column_index;
    });
}

export function groupFieldsByRow(fields: FormField[]): FormField[][] {
  const rows: Map<number, FormField[]> = new Map();
  
  fields.forEach((field) => {
    const rowIndex = field.row_index ?? 0;
    if (!rows.has(rowIndex)) {
      rows.set(rowIndex, []);
    }
    rows.get(rowIndex)!.push(field);
  });
  
  return Array.from(rows.entries())
    .sort(([a], [b]) => a - b)
    .map(([_, rowFields]) => rowFields.sort((a, b) => a.column_index - b.column_index));
}

export function validateFieldValue(
  value: any,
  field: FormField
): { valid: boolean; message?: string } {
  // Required check
  if (field.is_required && (!value || value === '')) {
    return { valid: false, message: 'Ce champ est obligatoire' };
  }
  
  // Skip further validation if empty and not required
  if (!value || value === '') {
    return { valid: true };
  }
  
  // Type-specific validation
  if (field.validation_type && VALIDATION_PATTERNS[field.validation_type]) {
    const pattern = VALIDATION_PATTERNS[field.validation_type];
    const strValue = String(value).replace(/\s/g, '');
    
    if (!pattern.test(strValue)) {
      return {
        valid: false,
        message: field.validation_message || `Format ${VALIDATION_TYPE_LABELS[field.validation_type]} invalide`,
      };
    }
  }
  
  // Custom regex validation
  if (field.validation_regex) {
    const regex = new RegExp(field.validation_regex);
    if (!regex.test(String(value))) {
      return {
        valid: false,
        message: field.validation_message || 'Format invalide',
      };
    }
  }
  
  // Min/Max validation for numbers
  if (field.field_type === 'number') {
    const numValue = parseFloat(value);
    if (field.min_value !== null && numValue < field.min_value) {
      return {
        valid: false,
        message: field.validation_message || `La valeur doit être supérieure à ${field.min_value}`,
      };
    }
    if (field.max_value !== null && numValue > field.max_value) {
      return {
        valid: false,
        message: field.validation_message || `La valeur doit être inférieure à ${field.max_value}`,
      };
    }
  }
  
  // SIRET/SIREN Luhn validation
  if (field.validation_type === 'siret' || field.validation_type === 'siren') {
    if (!validateLuhn(String(value).replace(/\s/g, ''))) {
      return {
        valid: false,
        message: field.validation_message || `Numéro ${field.validation_type.toUpperCase()} invalide (contrôle Luhn)`,
      };
    }
  }
  
  // IBAN validation
  if (field.validation_type === 'iban') {
    if (!validateIBAN(String(value).replace(/\s/g, ''))) {
      return {
        valid: false,
        message: field.validation_message || 'IBAN invalide',
      };
    }
  }
  
  return { valid: true };
}

// Luhn algorithm for SIRET/SIREN
function validateLuhn(num: string): boolean {
  const digits = num.split('').reverse().map(Number);
  let sum = 0;
  
  for (let i = 0; i < digits.length; i++) {
    let digit = digits[i];
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  
  return sum % 10 === 0;
}

// IBAN validation (simplified)
function validateIBAN(iban: string): boolean {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numericIBAN = rearranged
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      return code >= 65 && code <= 90 ? (code - 55).toString() : char;
    })
    .join('');
  
  // Mod 97 check
  let remainder = 0;
  for (let i = 0; i < numericIBAN.length; i++) {
    remainder = (remainder * 10 + parseInt(numericIBAN[i], 10)) % 97;
  }
  
  return remainder === 1;
}
