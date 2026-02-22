import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { RepeatableTableRenderer } from './RepeatableTableRenderer';
import { TemplateCustomField, CustomFieldType, LOOKUP_TABLES } from '@/types/customField';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import {
  Type,
  AlignLeft,
  Hash,
  Calendar,
  Clock,
  Mail,
  Phone,
  Link,
  CheckSquare,
  ChevronDown,
  ListChecks,
  UserSearch,
  Building2,
  Paperclip,
  AlertCircle,
  Database,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useFieldValidation,
  validateSingleField,
  formatValidationHint,
} from '@/hooks/useFieldValidation';
import type { ValidationType } from '@/types/formBuilder';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ValidatedCustomFieldsRendererProps {
  fields: TemplateCustomField[];
  values: Record<string, any>;
  onChange: (fieldId: string, value: any) => void;
  disabled?: boolean;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
  validateOnChange?: boolean;
  showValidationHints?: boolean;
}

interface UserOption {
  id: string;
  display_name: string;
}

interface DepartmentOption {
  id: string;
  name: string;
}

interface TableLookupOption {
  id: string;
  label: string;
}

const FIELD_ICONS: Record<CustomFieldType, React.ElementType> = {
  text: Type,
  textarea: AlignLeft,
  number: Hash,
  date: Calendar,
  datetime: Clock,
  email: Mail,
  phone: Phone,
  url: Link,
  checkbox: CheckSquare,
  select: ChevronDown,
  multiselect: ListChecks,
  user_search: UserSearch,
  department_search: Building2,
  file: Paperclip,
  table_lookup: Database,
  repeatable_table: Database,
};

export const ValidatedCustomFieldsRenderer = memo(function ValidatedCustomFieldsRenderer({
  fields,
  values,
  onChange,
  disabled = false,
  onValidationChange,
  validateOnChange = true,
  showValidationHints = true,
}: ValidatedCustomFieldsRendererProps) {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [tableLookupData, setTableLookupData] = useState<Record<string, TableLookupOption[]>>({});
  const [loadingTableLookup, setLoadingTableLookup] = useState<Record<string, boolean>>({});
  const [validationState, setValidationState] = useState<Record<string, { valid: boolean; message?: string }>>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  // Ref for scroll-to-error
  const fieldContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  // Ref to track which table_lookup fields we've already initiated loading for
  const tableLookupLoadingInitiated = useRef<Set<string>>(new Set());

  // Fetch users for user_search fields
  useEffect(() => {
    const hasUserSearch = fields.some((f) => f.field_type === 'user_search');
    if (hasUserSearch && users.length === 0) {
      setLoadingUsers(true);
      supabase
        .from('profiles')
        .select('id, display_name')
        .order('display_name')
        .then(({ data }) => {
          setUsers(data || []);
          setLoadingUsers(false);
        });
    }
  }, [fields, users.length]);

  // Fetch departments for department_search fields
  useEffect(() => {
    const hasDeptSearch = fields.some((f) => f.field_type === 'department_search');
    if (hasDeptSearch && departments.length === 0) {
      setLoadingDepartments(true);
      supabase
        .from('departments')
        .select('id, name')
        .order('name')
        .then(({ data }) => {
          setDepartments(data || []);
          setLoadingDepartments(false);
        });
    }
  }, [fields, departments.length]);

  // Fetch table lookup data for table_lookup fields
  // Uses a ref to track initiated loads, preventing infinite loops from state dependencies
  useEffect(() => {
    const tableLookupFields = fields.filter(
      (f) => f.field_type === 'table_lookup' && f.lookup_table
    );

    tableLookupFields.forEach((field) => {
      const fieldKey = field.id;
      
      // Use ref to check if we've already started loading this field
      if (tableLookupLoadingInitiated.current.has(fieldKey)) return;
      
      // Mark as initiated BEFORE setting state to prevent re-entry
      tableLookupLoadingInitiated.current.add(fieldKey);

      setLoadingTableLookup((prev) => ({ ...prev, [fieldKey]: true }));

      const tableName = field.lookup_table as string;
      const valueColumn = field.lookup_value_column || 'id';
      const labelColumn = field.lookup_label_column || 'name';

      let selectQuery = `${valueColumn}, ${labelColumn}`;

      supabase
        .from(tableName as any)
        .select(selectQuery)
        .order(labelColumn)
        .then(({ data, error }) => {
          if (!error && data) {
            const options = data.map((row: any) => ({
              id: String(row[valueColumn]),
              label: String(row[labelColumn] || row[valueColumn]),
            }));
            setTableLookupData((prev) => ({ ...prev, [fieldKey]: options }));
          }
          setLoadingTableLookup((prev) => ({ ...prev, [fieldKey]: false }));
        });
    });
  }, [fields]); // Only depends on fields, not on state

  // Validate a field in real-time
  const handleValidation = useCallback(
    (fieldId: string, value: any) => {
      const field = fields.find((f) => f.id === fieldId);
      if (!field) return;

      const result = validateSingleField(value, field);
      setValidationState((prev) => ({
        ...prev,
        [fieldId]: result,
      }));
    },
    [fields]
  );

  // Notify parent of validation changes
  useEffect(() => {
    if (onValidationChange) {
      const errors: Record<string, string> = {};
      let isValid = true;

      Object.entries(validationState).forEach(([fieldId, state]) => {
        if (!state.valid && state.message) {
          errors[fieldId] = state.message;
          isValid = false;
        }
      });

      onValidationChange(isValid, errors);
    }
  }, [validationState, onValidationChange]);

  // Check if a field should be visible based on conditions
  const isFieldVisible = (field: TemplateCustomField): boolean => {
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
          conditionValue
            .toLowerCase()
            .includes((field.condition_value || '').toLowerCase())
        );
      case 'not_empty':
        return Boolean(conditionValue && conditionValue !== '');
      default:
        return true;
    }
  };

  // Scroll to first error
  const scrollToFirstError = useCallback(() => {
    const firstErrorId = Object.entries(validationState).find(
      ([_, state]) => !state.valid
    )?.[0];
    
    if (firstErrorId && fieldContainerRefs.current[firstErrorId]) {
      fieldContainerRefs.current[firstErrorId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [validationState]);

  // Validate all fields
  const validateAllFields = useCallback((): { valid: boolean; errors: Record<string, string> } => {
    const errors: Record<string, string> = {};
    let valid = true;

    fields.forEach((field) => {
      if (isFieldVisible(field)) {
        const result = validateSingleField(values[field.id], field);
        if (!result.valid && result.message) {
          errors[field.id] = result.message;
          valid = false;
        }
        setValidationState((prev) => ({ ...prev, [field.id]: result }));
      }
    });

    // Mark all as touched
    setTouchedFields(new Set(fields.map((f) => f.id)));

    // Scroll to first error
    if (!valid) {
      setTimeout(scrollToFirstError, 100);
    }

    return { valid, errors };
  }, [fields, values, isFieldVisible, scrollToFirstError]);

  // Expose validateAllFields via a custom event
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const result = validateAllFields();
      e.detail.callback?.(result);
    };

    window.addEventListener('validate-custom-fields' as any, handler);
    return () => window.removeEventListener('validate-custom-fields' as any, handler);
  }, [validateAllFields]);

  const renderField = (field: TemplateCustomField) => {
    if (!isFieldVisible(field)) return null;

    const Icon = FIELD_ICONS[field.field_type];
    const value = values[field.id] ?? field.default_value ?? '';
    const validationResult = validationState[field.id];
    const isTouched = touchedFields.has(field.id);
    const showError = isTouched && validationResult && !validationResult.valid;
    const showSuccess = isTouched && validationResult?.valid && value !== '' && value !== undefined;
    const isRequired = field.is_required;
    const validationType = (field as any).validation_type as ValidationType | null;
    const hint = showValidationHints ? formatValidationHint(validationType) : '';

    const handleChange = (newValue: any) => {
      onChange(field.id, newValue);
      if (validateOnChange) {
        handleValidation(field.id, newValue);
      }
    };

    const handleBlur = () => {
      setTouchedFields((prev) => new Set(prev).add(field.id));
      handleValidation(field.id, value);
    };

    return (
      <div
        key={field.id}
        ref={(el) => {
          fieldContainerRefs.current[field.id] = el;
        }}
        className={cn(
          'space-y-2 transition-all',
          showError && 'animate-shake'
        )}
        data-field-id={field.id}
      >
        <Label htmlFor={field.id} className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {field.label}
          {isRequired && <span className="text-destructive">*</span>}
          {field.is_common && (
            <Badge variant="secondary" className="text-xs">
              Commun
            </Badge>
          )}
          {showSuccess && (
            <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
          )}
        </Label>

        {field.description && (
          <p className="text-xs text-muted-foreground">{field.description}</p>
        )}

        <div className="relative">
          {renderFieldInput(field, value, handleChange, handleBlur, showError, hint)}
          
          {showError && validationResult?.message && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 pr-8">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p>{validationResult.message}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>

        {showError && validationResult?.message && (
          <p className="text-xs text-destructive flex items-center gap-1 animate-fadeIn">
            <AlertCircle className="h-3 w-3" />
            {validationResult.message}
          </p>
        )}

        {hint && !showError && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Info className="h-3 w-3" />
            {hint}
          </p>
        )}
      </div>
    );
  };

  const renderFieldInput = (
    field: TemplateCustomField,
    value: any,
    handleChange: (v: any) => void,
    handleBlur: () => void,
    hasError: boolean,
    hint: string
  ) => {
    const inputClass = cn(
      'transition-all',
      hasError && 'border-destructive focus-visible:ring-destructive pr-10',
      !hasError && value && 'border-green-500/30'
    );

    switch (field.field_type) {
      case 'text':
        return (
          <Input
            id={field.id}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={field.placeholder || hint || ''}
            disabled={disabled}
            className={inputClass}
          />
        );

      case 'textarea':
        return (
          <Textarea
            id={field.id}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={field.placeholder || ''}
            disabled={disabled}
            className={inputClass}
            rows={3}
          />
        );

      case 'number':
        return (
          <Input
            id={field.id}
            type="number"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={field.placeholder || ''}
            disabled={disabled}
            className={inputClass}
            min={field.min_value ?? undefined}
            max={field.max_value ?? undefined}
          />
        );

      case 'date':
        return (
          <Input
            id={field.id}
            type="date"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            disabled={disabled}
            className={inputClass}
          />
        );

      case 'datetime':
        return (
          <Input
            id={field.id}
            type="datetime-local"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            disabled={disabled}
            className={inputClass}
          />
        );

      case 'email':
        return (
          <Input
            id={field.id}
            type="email"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={field.placeholder || 'email@example.com'}
            disabled={disabled}
            className={inputClass}
          />
        );

      case 'phone':
        return (
          <Input
            id={field.id}
            type="tel"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={field.placeholder || hint || '+33 6 00 00 00 00'}
            disabled={disabled}
            className={inputClass}
          />
        );

      case 'url':
        return (
          <Input
            id={field.id}
            type="url"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={field.placeholder || 'https://'}
            disabled={disabled}
            className={inputClass}
          />
        );

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.id}
              checked={value === 'true' || value === true}
              onCheckedChange={(checked) =>
                handleChange(checked ? 'true' : 'false')
              }
              disabled={disabled}
            />
            <label
              htmlFor={field.id}
              className="text-sm text-muted-foreground cursor-pointer"
            >
              {field.placeholder || 'Oui'}
            </label>
          </div>
        );

      case 'select': {
        // Normalize options: handle both {value,label} objects and plain strings
        const selectOptions = (field.options || []).map((opt: any) => {
          if (typeof opt === 'string') return { value: opt, label: opt };
          return { value: opt.value || opt, label: opt.label || opt.value || opt };
        });
        return (
          <Select
            value={value}
            onValueChange={(v) => {
              handleChange(v);
              handleBlur();
            }}
            disabled={disabled}
          >
            <SelectTrigger className={inputClass}>
              <SelectValue
                placeholder={field.placeholder || 'Sélectionner...'}
              />
            </SelectTrigger>
            <SelectContent>
              {selectOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }

      case 'multiselect': {
        // Normalize options: handle both {value,label} objects and plain strings
        const multiOptions = (field.options || []).map((opt: any) => {
          if (typeof opt === 'string') return { value: opt, label: opt };
          return { value: opt.value || opt, label: opt.label || opt.value || opt };
        });
        const selectedValues: string[] = value
          ? typeof value === 'string'
            ? value.split(',').filter(Boolean)
            : value
          : [];
        return (
          <div className="space-y-2">
            <div
              className={cn(
                'flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md bg-background',
                inputClass
              )}
            >
              {selectedValues.length === 0 ? (
                <span className="text-muted-foreground text-sm">
                  {field.placeholder || 'Sélectionner...'}
                </span>
              ) : (
                selectedValues.map((val) => {
                  const opt = multiOptions.find((o) => o.value === val);
                  return (
                    <Badge
                      key={val}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => {
                        if (!disabled) {
                          handleChange(
                            selectedValues.filter((v) => v !== val).join(',')
                          );
                        }
                      }}
                    >
                      {opt?.label || val} ×
                    </Badge>
                  );
                })
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {multiOptions
                .filter((opt) => !selectedValues.includes(opt.value))
                .map((opt) => (
                  <Badge
                    key={opt.value}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary/10"
                    onClick={() => {
                      if (!disabled) {
                        handleChange([...selectedValues, opt.value].join(','));
                      }
                    }}
                  >
                    + {opt.label}
                  </Badge>
                ))}
            </div>
          </div>
        );
      }

      case 'user_search':
        return (
          <Select
            value={value}
            onValueChange={(v) => {
              handleChange(v);
              handleBlur();
            }}
            disabled={disabled || loadingUsers}
          >
            <SelectTrigger className={inputClass}>
              <SelectValue
                placeholder={
                  loadingUsers
                    ? 'Chargement...'
                    : field.placeholder || 'Sélectionner un utilisateur...'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.display_name || 'Sans nom'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'department_search':
        return (
          <Select
            value={value}
            onValueChange={(v) => {
              handleChange(v);
              handleBlur();
            }}
            disabled={disabled || loadingDepartments}
          >
            <SelectTrigger className={inputClass}>
              <SelectValue
                placeholder={
                  loadingDepartments
                    ? 'Chargement...'
                    : field.placeholder || 'Sélectionner un service...'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'file':
        return (
          <div className="space-y-2">
            <Input
              id={field.id}
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleChange({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    file: file,
                  });
                }
              }}
              disabled={disabled}
              className={inputClass}
            />
            {value && typeof value === 'object' && value.name && (
              <p className="text-xs text-muted-foreground">
                Fichier sélectionné: {value.name}
              </p>
            )}
          </div>
        );

      case 'table_lookup':
        const lookupOptions = tableLookupData[field.id] || [];
        const isLoadingLookup = loadingTableLookup[field.id];
        const tableInfo = LOOKUP_TABLES.find(
          (t) => t.value === field.lookup_table
        );

        return (
          <Select
            value={value}
            onValueChange={(v) => {
              handleChange(v);
              handleBlur();
            }}
            disabled={disabled || isLoadingLookup}
          >
            <SelectTrigger className={inputClass}>
              <SelectValue
                placeholder={
                  isLoadingLookup
                    ? 'Chargement...'
                    : field.placeholder ||
                      `Sélectionner ${tableInfo?.label || 'une valeur'}...`
                }
              />
            </SelectTrigger>
            <SelectContent>
              {lookupOptions.map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'repeatable_table':
        return (
          <RepeatableTableRenderer
            field={field}
            value={value || null}
            onChange={handleChange}
            disabled={disabled}
          />
        );

      default:
        return (
          <Input
            id={field.id}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={field.placeholder || ''}
            disabled={disabled}
            className={inputClass}
          />
        );
    }
  };

  // Sort fields by order_index
  const sortedFields = [...fields].sort(
    (a, b) => a.order_index - b.order_index
  );

  return (
    <div className="space-y-4">{sortedFields.map(renderField)}</div>
  );
});

// Helper to trigger validation from parent components
export function triggerFieldValidation(): Promise<{ valid: boolean; errors: Record<string, string> }> {
  return new Promise((resolve) => {
    const event = new CustomEvent('validate-custom-fields', {
      detail: { callback: resolve },
    });
    window.dispatchEvent(event);
  });
}
