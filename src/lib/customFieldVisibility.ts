import type { TemplateCustomField } from '@/types/customField';

/** Vérifie si un champ conditionnel doit être affiché / validé (même règle que les renderers). */
export function isCustomFieldVisible(
  field: TemplateCustomField,
  values: Record<string, unknown>,
): boolean {
  if (!field.condition_field_id) return true;
  const conditionValue = values[field.condition_field_id];
  switch (field.condition_operator) {
    case 'equals':
      return conditionValue === field.condition_value;
    case 'not_equals':
      return conditionValue !== field.condition_value;
    case 'contains':
      return (
        typeof conditionValue === 'string' &&
        conditionValue.toLowerCase().includes((field.condition_value || '').toLowerCase())
      );
    case 'not_empty':
      return Boolean(conditionValue && conditionValue !== '');
    default:
      return true;
  }
}

/** Valeur effective pour validation (alignée sur l’UI : défaut + types). */
export function getEffectiveCustomFieldValue(
  field: TemplateCustomField,
  values: Record<string, unknown>,
): unknown {
  const v = values[field.id];
  if (v !== undefined && v !== null) return v;

  if (field.default_value !== undefined && field.default_value !== null && field.default_value !== '') {
    return field.default_value;
  }

  if (field.field_type === 'multiselect') return [];
  if (field.field_type === 'repeatable_table') return [];
  if (field.field_type === 'checkbox') return 'false';

  return '';
}
