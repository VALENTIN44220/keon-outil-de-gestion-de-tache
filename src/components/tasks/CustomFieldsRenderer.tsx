import { useState, useEffect } from 'react';
import { TemplateCustomField, CustomFieldType } from '@/types/customField';
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
} from 'lucide-react';

interface CustomFieldsRendererProps {
  fields: TemplateCustomField[];
  values: Record<string, any>;
  onChange: (fieldId: string, value: any) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

interface UserOption {
  id: string;
  display_name: string;
}

interface DepartmentOption {
  id: string;
  name: string;
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
};

export function CustomFieldsRenderer({
  fields,
  values,
  onChange,
  errors = {},
  disabled = false,
}: CustomFieldsRendererProps) {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(false);

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
        return typeof conditionValue === 'string' && 
               conditionValue.toLowerCase().includes((field.condition_value || '').toLowerCase());
      case 'not_empty':
        return Boolean(conditionValue && conditionValue !== '');
      default:
        return true;
    }
  };

  const renderField = (field: TemplateCustomField) => {
    if (!isFieldVisible(field)) return null;

    const Icon = FIELD_ICONS[field.field_type];
    const value = values[field.id] ?? field.default_value ?? '';
    const error = errors[field.id];
    const isRequired = field.is_required;

    const handleChange = (newValue: any) => {
      onChange(field.id, newValue);
    };

    const baseInputClass = error ? 'border-destructive' : '';

    return (
      <div key={field.id} className="space-y-2">
        <Label htmlFor={field.id} className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {field.label}
          {isRequired && <span className="text-destructive">*</span>}
          {field.is_common && (
            <Badge variant="secondary" className="text-xs">Commun</Badge>
          )}
        </Label>

        {field.description && (
          <p className="text-xs text-muted-foreground">{field.description}</p>
        )}

        {renderFieldInput(field, value, handleChange, baseInputClass)}

        {error && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {error}
          </p>
        )}
      </div>
    );
  };

  const renderFieldInput = (
    field: TemplateCustomField,
    value: any,
    handleChange: (v: any) => void,
    baseClass: string
  ) => {
    switch (field.field_type) {
      case 'text':
        return (
          <Input
            id={field.id}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder || ''}
            disabled={disabled}
            className={baseClass}
          />
        );

      case 'textarea':
        return (
          <Textarea
            id={field.id}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder || ''}
            disabled={disabled}
            className={baseClass}
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
            placeholder={field.placeholder || ''}
            disabled={disabled}
            className={baseClass}
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
            disabled={disabled}
            className={baseClass}
          />
        );

      case 'datetime':
        return (
          <Input
            id={field.id}
            type="datetime-local"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled}
            className={baseClass}
          />
        );

      case 'email':
        return (
          <Input
            id={field.id}
            type="email"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder || 'email@example.com'}
            disabled={disabled}
            className={baseClass}
          />
        );

      case 'phone':
        return (
          <Input
            id={field.id}
            type="tel"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder || '+33 6 00 00 00 00'}
            disabled={disabled}
            className={baseClass}
          />
        );

      case 'url':
        return (
          <Input
            id={field.id}
            type="url"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder || 'https://'}
            disabled={disabled}
            className={baseClass}
          />
        );

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.id}
              checked={value === 'true' || value === true}
              onCheckedChange={(checked) => handleChange(checked ? 'true' : 'false')}
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

      case 'select':
        return (
          <Select
            value={value}
            onValueChange={handleChange}
            disabled={disabled}
          >
            <SelectTrigger className={baseClass}>
              <SelectValue placeholder={field.placeholder || 'Sélectionner...'} />
            </SelectTrigger>
            <SelectContent>
              {(field.options || []).map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multiselect':
        const selectedValues: string[] = value ? (typeof value === 'string' ? value.split(',') : value) : [];
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md bg-background">
              {selectedValues.length === 0 ? (
                <span className="text-muted-foreground text-sm">
                  {field.placeholder || 'Sélectionner...'}
                </span>
              ) : (
                selectedValues.map((val) => {
                  const opt = (field.options || []).find((o) => o.value === val);
                  return (
                    <Badge
                      key={val}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => {
                        if (!disabled) {
                          handleChange(selectedValues.filter((v) => v !== val).join(','));
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
              {(field.options || [])
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

      case 'user_search':
        return (
          <Select
            value={value}
            onValueChange={handleChange}
            disabled={disabled || loadingUsers}
          >
            <SelectTrigger className={baseClass}>
              <SelectValue placeholder={loadingUsers ? 'Chargement...' : (field.placeholder || 'Sélectionner un utilisateur...')} />
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
            onValueChange={handleChange}
            disabled={disabled || loadingDepartments}
          >
            <SelectTrigger className={baseClass}>
              <SelectValue placeholder={loadingDepartments ? 'Chargement...' : (field.placeholder || 'Sélectionner un service...')} />
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
                  // Store file info for later upload
                  handleChange({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    file: file,
                  });
                }
              }}
              disabled={disabled}
              className={baseClass}
            />
            {value && typeof value === 'object' && value.name && (
              <p className="text-xs text-muted-foreground">
                Fichier sélectionné: {value.name}
              </p>
            )}
          </div>
        );

      default:
        return (
          <Input
            id={field.id}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder || ''}
            disabled={disabled}
            className={baseClass}
          />
        );
    }
  };

  // Group fields by scope for better organization
  const commonFields = fields.filter((f) => f.is_common);
  const specificFields = fields.filter((f) => !f.is_common);

  if (fields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {specificFields.length > 0 && (
        <div className="space-y-4">
          {specificFields.map(renderField)}
        </div>
      )}

      {commonFields.length > 0 && (
        <div className="space-y-4">
          {specificFields.length > 0 && (
            <div className="flex items-center gap-2 pt-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">Champs communs</span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}
          {commonFields.map(renderField)}
        </div>
      )}
    </div>
  );
}

// Validation helper
export function validateCustomFields(
  fields: TemplateCustomField[],
  values: Record<string, any>
): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const value = values[field.id];

    // Check required fields
    if (field.is_required) {
      if (value === undefined || value === null || value === '') {
        errors[field.id] = 'Ce champ est obligatoire';
        continue;
      }
    }

    // Skip validation if empty and not required
    if (!value && !field.is_required) continue;

    // Validate by field type
    switch (field.field_type) {
      case 'email':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors[field.id] = 'Email invalide';
        }
        break;
      case 'url':
        if (value && !/^https?:\/\/.+/.test(value)) {
          errors[field.id] = 'URL invalide (doit commencer par http:// ou https://)';
        }
        break;
      case 'number':
        if (value) {
          const num = parseFloat(value);
          if (isNaN(num)) {
            errors[field.id] = 'Valeur numérique invalide';
          } else {
            if (field.min_value !== null && num < field.min_value) {
              errors[field.id] = `La valeur doit être supérieure à ${field.min_value}`;
            }
            if (field.max_value !== null && num > field.max_value) {
              errors[field.id] = `La valeur doit être inférieure à ${field.max_value}`;
            }
          }
        }
        break;
      case 'phone':
        if (value && !/^[\d\s+\-().]+$/.test(value)) {
          errors[field.id] = 'Numéro de téléphone invalide';
        }
        break;
    }

    // Custom regex validation
    if (field.validation_regex && value) {
      try {
        const regex = new RegExp(field.validation_regex);
        if (!regex.test(value)) {
          errors[field.id] = 'Format invalide';
        }
      } catch {
        // Invalid regex, skip validation
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
