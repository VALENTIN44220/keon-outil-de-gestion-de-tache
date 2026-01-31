import { memo, useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { ChevronDown, ChevronRight, Info, AlertCircle, Eye, EyeOff } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useConditionsEngine, getConditionDescription } from '@/hooks/useConditionsEngine';
import { useFieldValidation } from '@/hooks/useFieldValidation';
import type { FormField, FormSection } from '@/types/formBuilder';
import type { TemplateCustomField } from '@/types/customField';

interface DynamicFieldsRendererProps {
  fields: TemplateCustomField[] | FormField[];
  sections?: FormSection[];
  values: Record<string, any>;
  onChange: (fieldId: string, value: any) => void;
  readOnly?: boolean;
  showHiddenFields?: boolean; // For admin preview mode
  highlightConditions?: boolean; // Show condition indicators
}

export const DynamicFieldsRenderer = memo(function DynamicFieldsRenderer({
  fields,
  sections = [],
  values,
  onChange,
  readOnly = false,
  showHiddenFields = false,
  highlightConditions = false,
}: DynamicFieldsRendererProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  // Use conditions engine
  const {
    isFieldVisible,
    isSectionVisible,
    getVisibleFieldsForSection,
    getVisibleSections,
  } = useConditionsEngine({
    fields: fields as FormField[],
    sections,
    fieldValues: values,
  });

  // Use field validation
  const { validateField, errors } = useFieldValidation(fields as FormField[]);

  // Initialize collapsed sections based on is_collapsed_by_default
  useEffect(() => {
    const defaultCollapsed = new Set<string>();
    sections.forEach((section) => {
      if (section.is_collapsed_by_default) {
        defaultCollapsed.add(section.id);
      }
    });
    setCollapsedSections(defaultCollapsed);
  }, [sections]);

  // Toggle section collapse
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

  // Handle field change with validation
  const handleFieldChange = useCallback(
    (fieldId: string, value: any) => {
      onChange(fieldId, value);
      setTouchedFields((prev) => new Set(prev).add(fieldId));
      // Trigger validation
      validateField(fieldId, value);
    },
    [onChange, validateField]
  );

  // Render a single field
  const renderField = useCallback(
    (field: FormField) => {
      const isVisible = showHiddenFields || isFieldVisible(field.id);
      const isHidden = !isFieldVisible(field.id);
      const value = values[field.id] ?? field.default_value ?? '';
      const error = errors[field.id];
      const isTouched = touchedFields.has(field.id);
      const isReadOnly = readOnly || (field as any).is_readonly;

      // Check if field has conditions
      const hasCondition = field.condition_field_id !== null;
      const conditionField = hasCondition
        ? fields.find((f) => f.id === field.condition_field_id)
        : null;

      if (!isVisible && !showHiddenFields) return null;

      return (
        <div
          key={field.id}
          className={cn(
            'space-y-2 transition-all duration-300',
            isHidden && showHiddenFields && 'opacity-50 border-l-2 border-dashed border-muted-foreground/30 pl-3',
            field.column_span && `col-span-${Math.min(field.column_span, 4)}`
          )}
          style={{
            gridColumn: `span ${Math.min(field.column_span || 1, 4)}`,
          }}
        >
          {/* Label with indicators */}
          <div className="flex items-center gap-2">
            <Label
              htmlFor={field.id}
              className={cn(
                'text-sm font-medium',
                error && isTouched && 'text-destructive'
              )}
            >
              {field.label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>

            {/* Condition indicator */}
            {highlightConditions && hasCondition && conditionField && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] px-1.5 py-0 gap-1',
                        isHidden
                          ? 'text-muted-foreground border-muted'
                          : 'text-blue-600 border-blue-300'
                      )}
                    >
                      {isHidden ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                      Condition
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      Affiché si :{' '}
                      {getConditionDescription(
                        field.condition_operator as any,
                        conditionField.label,
                        field.condition_value
                      )}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Help tooltip */}
            {field.description && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-xs">{field.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {/* Field input based on type */}
          {renderFieldInput(field, value, isReadOnly, handleFieldChange, error, isTouched)}

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
    [
      values,
      errors,
      touchedFields,
      readOnly,
      showHiddenFields,
      highlightConditions,
      isFieldVisible,
      handleFieldChange,
      fields,
    ]
  );

  // Render section with its fields
  const renderSection = useCallback(
    (section: FormSection) => {
      const isVisible = isSectionVisible(section.id);
      const sectionFields = getVisibleFieldsForSection(section.id);
      const isCollapsed = collapsedSections.has(section.id);

      // Check if section has conditions
      const hasCondition = section.condition_field_id !== null;
      const conditionField = hasCondition
        ? fields.find((f) => f.id === section.condition_field_id)
        : null;

      if (!isVisible && !showHiddenFields) return null;

      const sectionContent = (
        <Card
          className={cn(
            'transition-all duration-300',
            !isVisible && showHiddenFields && 'opacity-50 border-dashed'
          )}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {section.is_collapsible && (
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="p-0.5 hover:bg-muted rounded"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                )}
                <CardTitle className="text-sm font-semibold">{section.label}</CardTitle>

                {/* Condition indicator for section */}
                {highlightConditions && hasCondition && conditionField && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] px-1.5 py-0 gap-1',
                            !isVisible
                              ? 'text-muted-foreground border-muted'
                              : 'text-blue-600 border-blue-300'
                          )}
                        >
                          {!isVisible ? (
                            <EyeOff className="h-2.5 w-2.5" />
                          ) : (
                            <Eye className="h-2.5 w-2.5" />
                          )}
                          Condition
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">
                          Affiché si :{' '}
                          {getConditionDescription(
                            section.condition_operator as any,
                            conditionField.label,
                            section.condition_value
                          )}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              {section.is_common && (
                <Badge variant="secondary" className="text-[10px]">
                  Commun
                </Badge>
              )}
            </div>
            {section.description && (
              <p className="text-xs text-muted-foreground mt-1">{section.description}</p>
            )}
          </CardHeader>

          {(!section.is_collapsible || !isCollapsed) && (
            <CardContent className="pt-2">
              <div className="grid grid-cols-4 gap-4">
                {sectionFields.map(renderField)}
              </div>
            </CardContent>
          )}
        </Card>
      );

      if (section.is_collapsible) {
        return (
          <Collapsible key={section.id} open={!isCollapsed}>
            {sectionContent}
          </Collapsible>
        );
      }

      return <div key={section.id}>{sectionContent}</div>;
    },
    [
      isSectionVisible,
      getVisibleFieldsForSection,
      collapsedSections,
      showHiddenFields,
      highlightConditions,
      fields,
      toggleSection,
      renderField,
    ]
  );

  // Get orphan fields (not in any section)
  const orphanFields = useMemo(() => {
    return getVisibleFieldsForSection(null);
  }, [getVisibleFieldsForSection]);

  // Get visible sections sorted by order
  const visibleSections = useMemo(() => {
    const visible = showHiddenFields ? sections : getVisibleSections();
    return visible.sort((a, b) => a.order_index - b.order_index);
  }, [sections, showHiddenFields, getVisibleSections]);

  return (
    <div className="space-y-4">
      {/* Orphan fields */}
      {orphanFields.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {orphanFields.map(renderField)}
        </div>
      )}

      {/* Sections */}
      {visibleSections.map(renderSection)}

      {/* Empty state */}
      {orphanFields.length === 0 && visibleSections.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Aucun champ à afficher</p>
        </div>
      )}
    </div>
  );
});

// Helper function to render field input based on type
function renderFieldInput(
  field: FormField,
  value: any,
  isReadOnly: boolean,
  onChange: (fieldId: string, value: any) => void,
  error: string | undefined,
  isTouched: boolean
) {
  const baseInputClass = cn(
    'transition-colors',
    error && isTouched && 'border-destructive focus-visible:ring-destructive'
  );

  switch (field.field_type) {
    case 'text':
    case 'email':
    case 'phone':
    case 'url':
      return (
        <Input
          id={field.id}
          type={field.field_type === 'email' ? 'email' : field.field_type === 'url' ? 'url' : 'text'}
          value={value}
          onChange={(e) => onChange(field.id, e.target.value)}
          placeholder={field.placeholder || undefined}
          disabled={isReadOnly}
          className={baseInputClass}
        />
      );

    case 'textarea':
      return (
        <Textarea
          id={field.id}
          value={value}
          onChange={(e) => onChange(field.id, e.target.value)}
          placeholder={field.placeholder || undefined}
          disabled={isReadOnly}
          rows={3}
          className={baseInputClass}
        />
      );

    case 'number':
      return (
        <Input
          id={field.id}
          type="number"
          value={value}
          onChange={(e) => onChange(field.id, e.target.value)}
          placeholder={field.placeholder || undefined}
          disabled={isReadOnly}
          min={field.min_value ?? undefined}
          max={field.max_value ?? undefined}
          className={baseInputClass}
        />
      );

    case 'date':
      return (
        <Input
          id={field.id}
          type="date"
          value={value}
          onChange={(e) => onChange(field.id, e.target.value)}
          disabled={isReadOnly}
          className={baseInputClass}
        />
      );

    case 'datetime':
      return (
        <Input
          id={field.id}
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(field.id, e.target.value)}
          disabled={isReadOnly}
          className={baseInputClass}
        />
      );

    case 'checkbox':
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            id={field.id}
            checked={value === true || value === 'true'}
            onCheckedChange={(checked) => onChange(field.id, checked)}
            disabled={isReadOnly}
          />
          {field.placeholder && (
            <Label htmlFor={field.id} className="text-sm font-normal text-muted-foreground">
              {field.placeholder}
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
          <SelectTrigger className={baseInputClass}>
            <SelectValue placeholder={field.placeholder || 'Sélectionnez...'} />
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
      // Simplified multiselect as checkboxes
      return (
        <div className="space-y-2 border rounded-md p-2">
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
                  className="text-sm font-normal"
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
          value={value}
          onChange={(e) => onChange(field.id, e.target.value)}
          placeholder={field.placeholder || undefined}
          disabled={isReadOnly}
          className={baseInputClass}
        />
      );
  }
}
