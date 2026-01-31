import { useState, useCallback, useMemo, useRef } from 'react';
import type { TemplateCustomField } from '@/types/customField';
import type { ValidationType, FormField } from '@/types/formBuilder';

// =====================
// Validation Patterns
// =====================

const VALIDATION_PATTERNS: Record<string, RegExp> = {
  phone_fr: /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/,
  phone_intl: /^\+?[1-9]\d{1,14}$/,
  siret: /^\d{14}$/,
  siren: /^\d{9}$/,
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  url: /^https?:\/\/[^\s/$.?#].[^\s]*$/,
  iban: /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/,
  postal_code_fr: /^\d{5}$/,
};

const VALIDATION_MESSAGES: Record<string, string> = {
  phone_fr: 'Numéro de téléphone français invalide (ex: 06 12 34 56 78)',
  phone_intl: 'Numéro de téléphone international invalide (ex: +33612345678)',
  siret: 'Numéro SIRET invalide (14 chiffres)',
  siren: 'Numéro SIREN invalide (9 chiffres)',
  email: 'Adresse email invalide',
  url: 'URL invalide (doit commencer par http:// ou https://)',
  iban: 'IBAN invalide',
  postal_code_fr: 'Code postal invalide (5 chiffres)',
  min_length: 'Longueur minimum non atteinte',
  max_length: 'Longueur maximum dépassée',
  min_value: 'Valeur minimum non atteinte',
  max_value: 'Valeur maximum dépassée',
  date_min: 'Date trop ancienne',
  date_max: 'Date trop récente',
  regex: 'Format invalide',
  required: 'Ce champ est obligatoire',
};

// =====================
// Validation Functions
// =====================

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

function validateIBAN(iban: string): boolean {
  if (iban.length < 5) return false;
  
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numericIBAN = rearranged
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      return code >= 65 && code <= 90 ? (code - 55).toString() : char;
    })
    .join('');
  
  let remainder = 0;
  for (let i = 0; i < numericIBAN.length; i++) {
    remainder = (remainder * 10 + parseInt(numericIBAN[i], 10)) % 97;
  }
  
  return remainder === 1;
}

// =====================
// Main Validation
// =====================

export interface ValidationResult {
  valid: boolean;
  message?: string;
  fieldId?: string;
}

export interface FieldValidationOptions {
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  scrollToError?: boolean;
}

export function validateSingleField(
  value: any,
  field: TemplateCustomField | FormField
): ValidationResult {
  const strValue = value != null ? String(value).trim() : '';
  const isEmpty = strValue === '' || value === null || value === undefined;

  // Required check
  if (field.is_required && isEmpty) {
    return {
      valid: false,
      message: VALIDATION_MESSAGES.required,
      fieldId: field.id,
    };
  }

  // Skip further validation if empty and not required
  if (isEmpty) {
    return { valid: true, fieldId: field.id };
  }

  // Get validation type from field
  const validationType = (field as FormField).validation_type || 
    ((field.field_type === 'email') ? 'email' : 
     (field.field_type === 'phone') ? 'phone_fr' : 
     (field.field_type === 'url') ? 'url' : null);

  // Pattern-based validation
  if (validationType && VALIDATION_PATTERNS[validationType]) {
    const pattern = VALIDATION_PATTERNS[validationType];
    const cleanValue = strValue.replace(/\s/g, '');
    
    if (!pattern.test(cleanValue)) {
      return {
        valid: false,
        message: (field as FormField).validation_message || VALIDATION_MESSAGES[validationType] || 'Format invalide',
        fieldId: field.id,
      };
    }
  }

  // SIRET/SIREN Luhn validation
  if (validationType === 'siret' || validationType === 'siren') {
    const cleanValue = strValue.replace(/\s/g, '');
    if (!validateLuhn(cleanValue)) {
      return {
        valid: false,
        message: (field as FormField).validation_message || `Numéro ${validationType.toUpperCase()} invalide (contrôle de clé)`,
        fieldId: field.id,
      };
    }
  }

  // IBAN validation
  if (validationType === 'iban') {
    const cleanValue = strValue.replace(/\s/g, '').toUpperCase();
    if (!validateIBAN(cleanValue)) {
      return {
        valid: false,
        message: (field as FormField).validation_message || VALIDATION_MESSAGES.iban,
        fieldId: field.id,
      };
    }
  }

  // Custom regex validation
  if (field.validation_regex) {
    try {
      const regex = new RegExp(field.validation_regex);
      if (!regex.test(strValue)) {
        return {
          valid: false,
          message: (field as FormField).validation_message || VALIDATION_MESSAGES.regex,
          fieldId: field.id,
        };
      }
    } catch (e) {
      console.warn('Invalid regex:', field.validation_regex);
    }
  }

  // Number validation
  if (field.field_type === 'number' && !isEmpty) {
    const numValue = parseFloat(strValue);
    
    if (isNaN(numValue)) {
      return {
        valid: false,
        message: 'Veuillez entrer un nombre valide',
        fieldId: field.id,
      };
    }

    if (field.min_value !== null && field.min_value !== undefined && numValue < field.min_value) {
      return {
        valid: false,
        message: (field as FormField).validation_message || `La valeur doit être supérieure ou égale à ${field.min_value}`,
        fieldId: field.id,
      };
    }

    if (field.max_value !== null && field.max_value !== undefined && numValue > field.max_value) {
      return {
        valid: false,
        message: (field as FormField).validation_message || `La valeur doit être inférieure ou égale à ${field.max_value}`,
        fieldId: field.id,
      };
    }
  }

  // Text length validation
  if ((field.field_type === 'text' || field.field_type === 'textarea') && !isEmpty) {
    const validationParams = (field as FormField).validation_params || {};
    const minLength = validationParams.min_length;
    const maxLength = validationParams.max_length;

    if (minLength && strValue.length < minLength) {
      return {
        valid: false,
        message: (field as FormField).validation_message || `Minimum ${minLength} caractères requis`,
        fieldId: field.id,
      };
    }

    if (maxLength && strValue.length > maxLength) {
      return {
        valid: false,
        message: (field as FormField).validation_message || `Maximum ${maxLength} caractères autorisés`,
        fieldId: field.id,
      };
    }
  }

  // Date validation
  if ((field.field_type === 'date' || field.field_type === 'datetime') && !isEmpty) {
    const validationParams = (field as FormField).validation_params || {};
    const dateValue = new Date(strValue);
    
    if (isNaN(dateValue.getTime())) {
      return {
        valid: false,
        message: 'Date invalide',
        fieldId: field.id,
      };
    }

    if (validationParams.min_date) {
      const minDate = new Date(validationParams.min_date);
      if (dateValue < minDate) {
        return {
          valid: false,
          message: (field as FormField).validation_message || `La date doit être postérieure au ${minDate.toLocaleDateString('fr-FR')}`,
          fieldId: field.id,
        };
      }
    }

    if (validationParams.max_date) {
      const maxDate = new Date(validationParams.max_date);
      if (dateValue > maxDate) {
        return {
          valid: false,
          message: (field as FormField).validation_message || `La date doit être antérieure au ${maxDate.toLocaleDateString('fr-FR')}`,
          fieldId: field.id,
        };
      }
    }
  }

  return { valid: true, fieldId: field.id };
}

// =====================
// Hook
// =====================

export function useFieldValidation(
  fields: (TemplateCustomField | FormField)[],
  options: FieldValidationOptions = {}
) {
  const { scrollToError = true } = options;
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});

  // Register a field ref for scroll-to-error
  const registerFieldRef = useCallback((fieldId: string, ref: HTMLElement | null) => {
    fieldRefs.current[fieldId] = ref;
  }, []);

  // Validate a single field
  const validateField = useCallback((fieldId: string, value: any): boolean => {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return true;

    const result = validateSingleField(value, field);
    
    setErrors(prev => {
      if (result.valid) {
        const { [fieldId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [fieldId]: result.message || 'Erreur de validation' };
    });

    return result.valid;
  }, [fields]);

  // Mark a field as touched (for blur validation)
  const markTouched = useCallback((fieldId: string) => {
    setTouched(prev => ({ ...prev, [fieldId]: true }));
  }, []);

  // Validate all fields and return overall validity
  const validateAll = useCallback((values: Record<string, any>): {
    valid: boolean;
    errors: Record<string, string>;
    firstErrorFieldId: string | null;
  } => {
    const newErrors: Record<string, string> = {};
    let firstErrorFieldId: string | null = null;

    for (const field of fields) {
      const value = values[field.id];
      const result = validateSingleField(value, field);
      
      if (!result.valid && result.message) {
        newErrors[field.id] = result.message;
        if (!firstErrorFieldId) {
          firstErrorFieldId = field.id;
        }
      }
    }

    setErrors(newErrors);
    
    // Mark all fields as touched
    const allTouched: Record<string, boolean> = {};
    fields.forEach(f => { allTouched[f.id] = true; });
    setTouched(allTouched);

    // Scroll to first error
    if (scrollToError && firstErrorFieldId && fieldRefs.current[firstErrorFieldId]) {
      const element = fieldRefs.current[firstErrorFieldId];
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Focus the input if possible
      const input = element?.querySelector('input, textarea, select');
      if (input instanceof HTMLElement) {
        setTimeout(() => input.focus(), 300);
      }
    }

    return {
      valid: Object.keys(newErrors).length === 0,
      errors: newErrors,
      firstErrorFieldId,
    };
  }, [fields, scrollToError]);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setErrors({});
    setTouched({});
  }, []);

  // Clear a specific error
  const clearFieldError = useCallback((fieldId: string) => {
    setErrors(prev => {
      const { [fieldId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  // Check if form has any errors
  const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors]);

  // Get error for a specific field (only if touched)
  const getFieldError = useCallback((fieldId: string): string | undefined => {
    if (!touched[fieldId]) return undefined;
    return errors[fieldId];
  }, [errors, touched]);

  return {
    errors,
    touched,
    hasErrors,
    validateField,
    validateAll,
    markTouched,
    clearErrors,
    clearFieldError,
    getFieldError,
    registerFieldRef,
  };
}

// =====================
// Validation Helpers
// =====================

export function getValidationTypesForFieldType(fieldType: string): ValidationType[] {
  switch (fieldType) {
    case 'text':
      return ['email', 'phone_fr', 'phone_intl', 'url', 'postal_code_fr', 'regex', 'min_length', 'max_length'];
    case 'textarea':
      return ['min_length', 'max_length', 'regex'];
    case 'number':
      return ['siret', 'siren', 'min_value', 'max_value'];
    case 'date':
    case 'datetime':
      return ['date_range'];
    case 'email':
      return ['email'];
    case 'phone':
      return ['phone_fr', 'phone_intl'];
    case 'url':
      return ['url'];
    default:
      return [];
  }
}

export function formatValidationHint(validationType: ValidationType | null): string {
  switch (validationType) {
    case 'phone_fr':
      return 'Format: 06 12 34 56 78 ou +33 6 12 34 56 78';
    case 'phone_intl':
      return 'Format: +33612345678';
    case 'siret':
      return '14 chiffres (ex: 12345678901234)';
    case 'siren':
      return '9 chiffres (ex: 123456789)';
    case 'email':
      return 'ex: nom@domaine.fr';
    case 'url':
      return 'ex: https://www.exemple.fr';
    case 'postal_code_fr':
      return '5 chiffres (ex: 75001)';
    case 'iban':
      return 'ex: FR76 1234 5678 9012 3456 7890 123';
    default:
      return '';
  }
}
