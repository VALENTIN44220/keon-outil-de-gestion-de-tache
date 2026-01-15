export type CustomFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime'
  | 'email'
  | 'phone'
  | 'url'
  | 'checkbox'
  | 'select'
  | 'multiselect'
  | 'user_search'
  | 'department_search'
  | 'file';

export const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'Texte court',
  textarea: 'Texte long',
  number: 'Nombre',
  date: 'Date',
  datetime: 'Date et heure',
  email: 'Email',
  phone: 'Téléphone',
  url: 'URL',
  checkbox: 'Case à cocher',
  select: 'Liste déroulante',
  multiselect: 'Liste multiple',
  user_search: 'Recherche utilisateur',
  department_search: 'Recherche service',
  file: 'Fichier',
};

export const FIELD_TYPE_ICONS: Record<CustomFieldType, string> = {
  text: 'Type',
  textarea: 'AlignLeft',
  number: 'Hash',
  date: 'Calendar',
  datetime: 'Clock',
  email: 'Mail',
  phone: 'Phone',
  url: 'Link',
  checkbox: 'CheckSquare',
  select: 'ChevronDown',
  multiselect: 'ListChecks',
  user_search: 'UserSearch',
  department_search: 'Building2',
  file: 'Paperclip',
};

export interface FieldOption {
  value: string;
  label: string;
}

export interface TemplateCustomField {
  id: string;
  name: string;
  label: string;
  field_type: CustomFieldType;
  description: string | null;
  process_template_id: string | null;
  sub_process_template_id: string | null;
  is_common: boolean;
  is_required: boolean;
  options: FieldOption[] | null;
  default_value: string | null;
  placeholder: string | null;
  validation_regex: string | null;
  min_value: number | null;
  max_value: number | null;
  condition_field_id: string | null;
  condition_operator: 'equals' | 'not_equals' | 'contains' | 'not_empty' | null;
  condition_value: string | null;
  order_index: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequestFieldValue {
  id: string;
  task_id: string;
  field_id: string;
  value: string | null;
  file_url: string | null;
  created_at: string;
  updated_at: string;
}

export type FieldScope = 'common' | 'process' | 'sub_process';
