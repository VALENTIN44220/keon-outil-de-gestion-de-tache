import { memo, useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ChevronDown,
  ChevronRight,
  Info,
  AlertCircle,
  Check,
  User,
  Building2,
  Calendar,
  Flag,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConditionsEngine } from '@/hooks/useConditionsEngine';
import { useFieldValidation } from '@/hooks/useFieldValidation';
import type { FormSchema, FormSchemaSection, FormSchemaPlacement } from '@/types/formSchema';
import type { FormField } from '@/types/formBuilder';
import type { TemplateCustomField } from '@/types/customField';

interface CardFormRendererProps {
  schema: FormSchema;
  fields: TemplateCustomField[];
  values: Record<string, any>;
  onChange: (fieldId: string, value: any) => void;
  onSubmit?: () => void;
  readOnly?: boolean;
  isSubmitting?: boolean;
  className?: string;
}

// Common field definitions
const COMMON_FIELDS_CONFIG = {
  requester: {
    id: 'requester',
    label: 'Demandeur',
    icon: User,
    type: 'user_search',
  },
  company: {
    id: 'company',
    label: 'Société',
    icon: Building2,
    type: 'text',
  },
  department: {
    id: 'department',
    label: 'Service',
    icon: Building2,
    type: 'text',
  },
  priority: {
    id: 'priority',
    label: 'Priorité',
    icon: Flag,
    type: 'select',
    options: [
      { value: 'low', label: 'Basse' },
      { value: 'medium', label: 'Moyenne' },
      { value: 'high', label: 'Haute' },
      { value: 'urgent', label: 'Urgente' },
    ],
  },
  due_date: {
    id: 'due_date',
    label: 'Échéance',
    icon: Calendar,
    type: 'date',
  },
};

export const CardFormRenderer = memo(function CardFormRenderer({
  schema,
  fields,
  values,
  onChange,
  onSubmit,
  readOnly = false,
  isSubmitting = false,
  className,
}: CardFormRendererProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  // Convert to FormField for conditions engine
  const formFields = useMemo(() => {
    return fields.map((f) => ({
      ...f,
      section_id: null,
      column_span: 2,
      row_index: null,
      column_index: 0,
      width_ratio: null,
      validation_type: null,
      validation_message: null,
      validation_params: null,
      conditions_logic: 'AND' as const,
      additional_conditions: null,
    })) as FormField[];
  }, [fields]);

  // Use conditions engine
  const { isFieldVisible, isSectionVisible } = useConditionsEngine({
    fields: formFields,
    sections: schema.sections.map((s) => ({
      id: s.id,
      name: s.name,
      label: s.label,
      description: s.description || null,
      process_template_id: null,
      sub_process_template_id: null,
      is_common: false,
      is_collapsible: s.is_collapsible,
      is_collapsed_by_default: s.is_collapsed_by_default,
      order_index: s.order_index,
      condition_field_id: s.condition?.field_id || null,
      condition_operator: s.condition?.operator || null,
      condition_value: s.condition?.value || null,
      created_by: null,
      created_at: '',
      updated_at: '',
    })),
    fieldValues: values,
  });

  // Use field validation
  const { validateField, errors } = useFieldValidation(formFields);

  // Initialize collapsed sections
  useEffect(() => {
    const defaultCollapsed = new Set<string>();
    schema.sections.forEach((section) => {
      if (section.is_collapsed_by_default) {
        defaultCollapsed.add(section.id);
      }
    });
    setCollapsedSections(defaultCollapsed);
  }, [schema.sections]);

  // Toggle section
  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  // Handle field change
  const handleFieldChange = useCallback(
    (fieldId: string, value: any) => {
      onChange(fieldId, value);
      setTouchedFields((prev) => new Set(prev).add(fieldId));
      validateField(fieldId, value);
    },
    [onChange, validateField]
  );

  // Get placement for a field
  const getPlacement = useCallback(
    (fieldId: string): FormSchemaPlacement | undefined => {
      return schema.placements.find((p) => p.field_id === fieldId);
    },
    [schema.placements]
  );

  // Get fields for a section
  const getFieldsForSection = useCallback(
    (sectionId: string): Array<{ field: TemplateCustomField; placement: FormSchemaPlacement }> => {
      return schema.placements
        .filter((p) => p.section_id === sectionId)
        .sort((a, b) => a.order_index - b.order_index)
        .map((placement) => {
          const field = fields.find((f) => f.id === placement.field_id);
          return field ? { field, placement } : null;
        })
        .filter(Boolean) as Array<{ field: TemplateCustomField; placement: FormSchemaPlacement }>;
    },
    [schema.placements, fields]
  );

  // Render a field input
  const renderFieldInput = useCallback(
    (
      field: TemplateCustomField,
      placement: FormSchemaPlacement,
      value: any,
      isReadOnly: boolean
    ) => {
      const overrides = placement.overrides;
      const label = overrides.label || field.label;
      const placeholder = overrides.placeholder || field.placeholder || undefined;
      const description = overrides.description || field.description;
      const isRequired = overrides.is_required ?? field.is_required;
      const isFieldReadOnly = isReadOnly || overrides.is_readonly;
      const error = errors[field.id];
      const isTouched = touchedFields.has(field.id);

      const baseInputClass = cn(
        'transition-all duration-200',
        error && isTouched && 'border-destructive focus-visible:ring-destructive',
        !error && isTouched && value && 'border-green-500/50'
      );

      // Hidden fields
      if (overrides.is_hidden) return null;

      // Check visibility via conditions
      if (!isFieldVisible(field.id)) return null;

      return (
        <div
          key={field.id}
          className="space-y-2"
          style={{
            gridColumn: `span ${placement.column_span}`,
          }}
        >
          {/* Label */}
          <div className="flex items-center gap-2">
            <Label
              htmlFor={field.id}
              className={cn(
                'text-sm font-medium',
                error && isTouched && 'text-destructive'
              )}
            >
              {label}
              {isRequired && <span className="text-destructive ml-1">*</span>}
            </Label>

            {description && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-xs">{description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Success indicator */}
            {!error && isTouched && value && (
              <Check className="h-3.5 w-3.5 text-green-500" />
            )}
          </div>

          {/* Input based on type */}
          {renderInput(
            field,
            value,
            placeholder,
            isFieldReadOnly,
            baseInputClass,
            handleFieldChange
          )}

          {/* Error message */}
          {error && isTouched && (
            <p className="text-xs text-destructive flex items-center gap-1 animate-fadeIn">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}
        </div>
      );
    },
    [errors, touchedFields, isFieldVisible, handleFieldChange]
  );

  // Render common fields
  const renderCommonFields = useCallback(() => {
    const enabledCommonFields = Object.entries(schema.common_fields)
      .filter(([_, enabled]) => enabled)
      .map(([key]) => key);

    if (enabledCommonFields.length === 0) return null;

    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Informations générales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn(
            'grid gap-4',
            schema.global_settings.columns === 1 && 'grid-cols-1',
            schema.global_settings.columns === 2 && 'grid-cols-2',
            schema.global_settings.columns === 3 && 'grid-cols-3',
            schema.global_settings.columns === 4 && 'grid-cols-4',
          )}>
            {enabledCommonFields.map((key) => {
              const config = COMMON_FIELDS_CONFIG[key as keyof typeof COMMON_FIELDS_CONFIG];
              if (!config) return null;

              const value = values[config.id] || '';
              const Icon = config.icon;

              return (
                <div key={key} className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    {config.label}
                  </Label>

                  {config.type === 'select' && 'options' in config ? (
                    <Select
                      value={value}
                      onValueChange={(v) => handleFieldChange(config.id, v)}
                      disabled={readOnly}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {config.options.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : config.type === 'date' ? (
                    <Input
                      type="date"
                      value={value}
                      onChange={(e) => handleFieldChange(config.id, e.target.value)}
                      disabled={readOnly}
                    />
                  ) : (
                    <Input
                      type="text"
                      value={value}
                      onChange={(e) => handleFieldChange(config.id, e.target.value)}
                      disabled={readOnly}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }, [schema.common_fields, schema.global_settings.columns, values, readOnly, handleFieldChange]);

  // Render section
  const renderSection = useCallback(
    (section: FormSchemaSection) => {
      const sectionFields = getFieldsForSection(section.id);
      const isCollapsed = collapsedSections.has(section.id);

      // Check visibility
      if (!isSectionVisible(section.id)) return null;

      return (
        <Card
          key={section.id}
          className={cn(
            'transition-all duration-300',
            schema.global_settings.show_section_borders
              ? 'border-border'
              : 'border-transparent shadow-none',
            schema.global_settings.compact_mode && 'py-2'
          )}
        >
          <CardHeader className={cn('pb-3', schema.global_settings.compact_mode && 'py-2')}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {section.is_collapsible && (
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="p-1 hover:bg-muted rounded-md transition-colors"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                )}
                <CardTitle className="text-sm font-semibold">{section.label}</CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {sectionFields.length} champ{sectionFields.length > 1 ? 's' : ''}
              </Badge>
            </div>
            {section.description && (
              <CardDescription className="text-xs mt-1">
                {section.description}
              </CardDescription>
            )}
          </CardHeader>

          {(!section.is_collapsible || !isCollapsed) && (
            <CardContent className={schema.global_settings.compact_mode ? 'py-2' : undefined}>
              <div
                className={cn(
                  'grid gap-4',
                  section.columns === 1 && 'grid-cols-1',
                  section.columns === 2 && 'grid-cols-2',
                  section.columns === 3 && 'grid-cols-3',
                  section.columns === 4 && 'grid-cols-4',
                )}
              >
                {sectionFields.map(({ field, placement }) =>
                  renderFieldInput(field, placement, values[field.id], readOnly)
                )}
              </div>

              {sectionFields.length === 0 && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  Aucun champ dans cette section
                </div>
              )}
            </CardContent>
          )}
        </Card>
      );
    },
    [
      getFieldsForSection,
      collapsedSections,
      isSectionVisible,
      schema.global_settings,
      values,
      readOnly,
      toggleSection,
      renderFieldInput,
    ]
  );

  // Sort sections by order
  const sortedSections = useMemo(
    () => [...schema.sections].sort((a, b) => a.order_index - b.order_index),
    [schema.sections]
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Common fields */}
      {renderCommonFields()}

      {/* Sections */}
      {sortedSections.map(renderSection)}

      {/* Submit button */}
      {onSubmit && (
        <div className="flex justify-end pt-4">
          <Button
            onClick={onSubmit}
            disabled={isSubmitting || readOnly}
            className="min-w-32"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Envoi...
              </>
            ) : (
              'Soumettre'
            )}
          </Button>
        </div>
      )}
    </div>
  );
});

// Helper function to render input based on field type
function renderInput(
  field: TemplateCustomField,
  value: any,
  placeholder: string | undefined,
  isReadOnly: boolean,
  className: string,
  onChange: (fieldId: string, value: any) => void
) {
  switch (field.field_type) {
    case 'text':
    case 'email':
    case 'phone':
    case 'url':
      return (
        <Input
          id={field.id}
          type={field.field_type === 'email' ? 'email' : 'text'}
          value={value || ''}
          onChange={(e) => onChange(field.id, e.target.value)}
          placeholder={placeholder}
          disabled={isReadOnly}
          className={className}
        />
      );

    case 'textarea':
      return (
        <Textarea
          id={field.id}
          value={value || ''}
          onChange={(e) => onChange(field.id, e.target.value)}
          placeholder={placeholder}
          disabled={isReadOnly}
          rows={3}
          className={className}
        />
      );

    case 'number':
      return (
        <Input
          id={field.id}
          type="number"
          value={value || ''}
          onChange={(e) => onChange(field.id, e.target.value)}
          placeholder={placeholder}
          disabled={isReadOnly}
          min={field.min_value ?? undefined}
          max={field.max_value ?? undefined}
          className={className}
        />
      );

    case 'date':
      return (
        <Input
          id={field.id}
          type="date"
          value={value || ''}
          onChange={(e) => onChange(field.id, e.target.value)}
          disabled={isReadOnly}
          className={className}
        />
      );

    case 'datetime':
      return (
        <Input
          id={field.id}
          type="datetime-local"
          value={value || ''}
          onChange={(e) => onChange(field.id, e.target.value)}
          disabled={isReadOnly}
          className={className}
        />
      );

    case 'checkbox':
      return (
        <div className="flex items-center gap-2 pt-2">
          <Checkbox
            id={field.id}
            checked={value === true || value === 'true'}
            onCheckedChange={(checked) => onChange(field.id, checked)}
            disabled={isReadOnly}
          />
          {placeholder && (
            <Label htmlFor={field.id} className="text-sm font-normal text-muted-foreground">
              {placeholder}
            </Label>
          )}
        </div>
      );

    case 'select':
      return (
        <Select
          value={value || ''}
          onValueChange={(v) => onChange(field.id, v)}
          disabled={isReadOnly}
        >
          <SelectTrigger className={className}>
            <SelectValue placeholder={placeholder || 'Sélectionnez...'} />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            {field.options?.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case 'multiselect':
      return (
        <div className="space-y-2 border rounded-md p-3 bg-muted/30">
          {field.options?.map((option) => {
            const selectedValues = Array.isArray(value) ? value : [];
            const isChecked = selectedValues.includes(option.value);
            return (
              <div key={option.value} className="flex items-center gap-2">
                <Checkbox
                  id={`${field.id}-${option.value}`}
                  checked={isChecked}
                  onCheckedChange={(checked) => {
                    const newValues = checked
                      ? [...selectedValues, option.value]
                      : selectedValues.filter((v: string) => v !== option.value);
                    onChange(field.id, newValues);
                  }}
                  disabled={isReadOnly}
                />
                <Label
                  htmlFor={`${field.id}-${option.value}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {option.label}
                </Label>
              </div>
            );
          })}
        </div>
      );

    default:
      return (
        <Input
          id={field.id}
          type="text"
          value={value || ''}
          onChange={(e) => onChange(field.id, e.target.value)}
          placeholder={placeholder}
          disabled={isReadOnly}
          className={className}
        />
      );
  }
}
