import { useMemo, useCallback } from 'react';
import type { FormField, FormSection, ConditionOperator, FieldCondition } from '@/types/formBuilder';

interface ConditionContext {
  fieldValues: Record<string, any>;
  fields: FormField[];
}

/**
 * Evaluates a single condition against the current field values
 */
function evaluateCondition(
  conditionFieldId: string,
  operator: ConditionOperator,
  expectedValue: string | null,
  context: ConditionContext
): boolean {
  const actualValue = context.fieldValues[conditionFieldId];
  const field = context.fields.find((f) => f.id === conditionFieldId);

  // Normalize values for comparison
  const normalizeValue = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (Array.isArray(val)) return val.join(',');
    return String(val).trim().toLowerCase();
  };

  const actual = normalizeValue(actualValue);
  const expected = normalizeValue(expectedValue);

  switch (operator) {
    case 'equals':
      return actual === expected;

    case 'not_equals':
      return actual !== expected;

    case 'contains':
      return actual.includes(expected);

    case 'not_contains':
      return !actual.includes(expected);

    case 'starts_with':
      return actual.startsWith(expected);

    case 'ends_with':
      return actual.endsWith(expected);

    case 'greater_than': {
      const numActual = parseFloat(actual);
      const numExpected = parseFloat(expected);
      if (isNaN(numActual) || isNaN(numExpected)) {
        // Try date comparison
        const dateActual = new Date(actualValue);
        const dateExpected = new Date(expectedValue || '');
        if (!isNaN(dateActual.getTime()) && !isNaN(dateExpected.getTime())) {
          return dateActual > dateExpected;
        }
        return false;
      }
      return numActual > numExpected;
    }

    case 'less_than': {
      const numActual = parseFloat(actual);
      const numExpected = parseFloat(expected);
      if (isNaN(numActual) || isNaN(numExpected)) {
        // Try date comparison
        const dateActual = new Date(actualValue);
        const dateExpected = new Date(expectedValue || '');
        if (!isNaN(dateActual.getTime()) && !isNaN(dateExpected.getTime())) {
          return dateActual < dateExpected;
        }
        return false;
      }
      return numActual < numExpected;
    }

    case 'is_empty':
      return actual === '' || actualValue === null || actualValue === undefined;

    case 'not_empty':
      return actual !== '' && actualValue !== null && actualValue !== undefined;

    case 'in_list': {
      const list = expected.split(',').map((v) => v.trim().toLowerCase());
      return list.includes(actual);
    }

    case 'not_in_list': {
      const list = expected.split(',').map((v) => v.trim().toLowerCase());
      return !list.includes(actual);
    }

    default:
      return true;
  }
}

/**
 * Evaluates all conditions for a field or section
 */
function evaluateAllConditions(
  mainCondition: {
    fieldId: string | null;
    operator: ConditionOperator | null;
    value: string | null;
  },
  additionalConditions: FieldCondition[] | null,
  logic: 'AND' | 'OR',
  context: ConditionContext
): boolean {
  // If no main condition, the element is always visible
  if (!mainCondition.fieldId || !mainCondition.operator) {
    return true;
  }

  // Evaluate the main condition
  const mainResult = evaluateCondition(
    mainCondition.fieldId,
    mainCondition.operator,
    mainCondition.value,
    context
  );

  // If no additional conditions, return the main result
  if (!additionalConditions || additionalConditions.length === 0) {
    return mainResult;
  }

  // Evaluate additional conditions
  const additionalResults = additionalConditions.map((cond) =>
    evaluateCondition(cond.field_id, cond.operator as ConditionOperator, cond.value, context)
  );

  // Combine results based on logic
  const allResults = [mainResult, ...additionalResults];

  if (logic === 'AND') {
    return allResults.every(Boolean);
  } else {
    return allResults.some(Boolean);
  }
}

export interface UseConditionsEngineProps {
  fields: FormField[];
  sections: FormSection[];
  fieldValues: Record<string, any>;
}

export interface UseConditionsEngineResult {
  isFieldVisible: (fieldId: string) => boolean;
  isSectionVisible: (sectionId: string) => boolean;
  getVisibleFields: () => FormField[];
  getVisibleSections: () => FormSection[];
  getVisibleFieldsForSection: (sectionId: string | null) => FormField[];
}

/**
 * Hook that provides a conditions evaluation engine for dynamic field/section visibility
 */
export function useConditionsEngine({
  fields,
  sections,
  fieldValues,
}: UseConditionsEngineProps): UseConditionsEngineResult {
  const context: ConditionContext = useMemo(
    () => ({
      fieldValues,
      fields,
    }),
    [fieldValues, fields]
  );

  // Check if a field is visible based on its conditions
  const isFieldVisible = useCallback(
    (fieldId: string): boolean => {
      const field = fields.find((f) => f.id === fieldId);
      if (!field) return false;

      // Check if field is explicitly hidden
      if ((field as any).is_hidden) return false;

      // Check if the field's section is visible
      if (field.section_id) {
        const section = sections.find((s) => s.id === field.section_id);
        if (section && !isSectionVisibleInternal(section)) {
          return false;
        }
      }

      // Evaluate field conditions
      return evaluateAllConditions(
        {
          fieldId: field.condition_field_id,
          operator: field.condition_operator as ConditionOperator | null,
          value: field.condition_value,
        },
        field.additional_conditions,
        field.conditions_logic || 'AND',
        context
      );
    },
    [fields, sections, context]
  );

  // Internal function to check section visibility without circular dependency
  const isSectionVisibleInternal = useCallback(
    (section: FormSection): boolean => {
      return evaluateAllConditions(
        {
          fieldId: section.condition_field_id,
          operator: section.condition_operator as ConditionOperator | null,
          value: section.condition_value,
        },
        null, // Sections don't have additional conditions for now
        'AND',
        context
      );
    },
    [context]
  );

  // Check if a section is visible based on its conditions
  const isSectionVisible = useCallback(
    (sectionId: string): boolean => {
      const section = sections.find((s) => s.id === sectionId);
      if (!section) return false;

      return isSectionVisibleInternal(section);
    },
    [sections, isSectionVisibleInternal]
  );

  // Get all visible fields
  const getVisibleFields = useCallback((): FormField[] => {
    return fields.filter((f) => isFieldVisible(f.id));
  }, [fields, isFieldVisible]);

  // Get all visible sections
  const getVisibleSections = useCallback((): FormSection[] => {
    return sections.filter((s) => isSectionVisible(s.id));
  }, [sections, isSectionVisible]);

  // Get visible fields for a specific section
  const getVisibleFieldsForSection = useCallback(
    (sectionId: string | null): FormField[] => {
      return fields
        .filter((f) => f.section_id === sectionId)
        .filter((f) => isFieldVisible(f.id))
        .sort((a, b) => a.order_index - b.order_index);
    },
    [fields, isFieldVisible]
  );

  return {
    isFieldVisible,
    isSectionVisible,
    getVisibleFields,
    getVisibleSections,
    getVisibleFieldsForSection,
  };
}

/**
 * Helper to get the label for a condition operator
 */
export function getConditionDescription(
  operator: ConditionOperator,
  fieldLabel: string,
  value: string | null
): string {
  switch (operator) {
    case 'equals':
      return `"${fieldLabel}" = "${value}"`;
    case 'not_equals':
      return `"${fieldLabel}" ≠ "${value}"`;
    case 'contains':
      return `"${fieldLabel}" contient "${value}"`;
    case 'not_contains':
      return `"${fieldLabel}" ne contient pas "${value}"`;
    case 'starts_with':
      return `"${fieldLabel}" commence par "${value}"`;
    case 'ends_with':
      return `"${fieldLabel}" se termine par "${value}"`;
    case 'greater_than':
      return `"${fieldLabel}" > ${value}`;
    case 'less_than':
      return `"${fieldLabel}" < ${value}`;
    case 'is_empty':
      return `"${fieldLabel}" est vide`;
    case 'not_empty':
      return `"${fieldLabel}" n'est pas vide`;
    case 'in_list':
      return `"${fieldLabel}" dans [${value}]`;
    case 'not_in_list':
      return `"${fieldLabel}" pas dans [${value}]`;
    default:
      return '';
  }
}
