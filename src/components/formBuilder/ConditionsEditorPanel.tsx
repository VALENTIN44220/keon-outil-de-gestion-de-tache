import { memo, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Eye, GitBranch, AlertCircle } from 'lucide-react';
import type { FormField, ConditionOperator, FieldCondition } from '@/types/formBuilder';
import { CONDITION_OPERATOR_LABELS } from '@/types/formBuilder';
import { cn } from '@/lib/utils';

interface ConditionsEditorPanelProps {
  field: FormField;
  allFields: FormField[];
  onUpdate: (updates: Partial<FormField>) => void;
  disabled?: boolean;
}

export const ConditionsEditorPanel = memo(function ConditionsEditorPanel({
  field,
  allFields,
  onUpdate,
  disabled = false,
}: ConditionsEditorPanelProps) {
  // Get available fields for conditions (exclude self)
  const availableFields = allFields.filter((f) => f.id !== field.id);

  // Get additional conditions
  const additionalConditions: FieldCondition[] = field.additional_conditions || [];

  // Update main condition
  const handleMainConditionChange = useCallback(
    (key: 'condition_field_id' | 'condition_operator' | 'condition_value', value: any) => {
      onUpdate({ [key]: value === '__none__' ? null : value });
    },
    [onUpdate]
  );

  // Update logic
  const handleLogicChange = useCallback(
    (logic: 'AND' | 'OR') => {
      onUpdate({ conditions_logic: logic });
    },
    [onUpdate]
  );

  // Add additional condition
  const addCondition = useCallback(() => {
    if (availableFields.length === 0) return;

    const newCondition: FieldCondition = {
      field_id: availableFields[0].id,
      operator: 'equals',
      value: '',
    };

    onUpdate({
      additional_conditions: [...additionalConditions, newCondition],
    });
  }, [availableFields, additionalConditions, onUpdate]);

  // Update additional condition
  const updateCondition = useCallback(
    (index: number, key: keyof FieldCondition, value: string) => {
      const updated = [...additionalConditions];
      updated[index] = { ...updated[index], [key]: value };
      onUpdate({ additional_conditions: updated });
    },
    [additionalConditions, onUpdate]
  );

  // Remove additional condition
  const removeCondition = useCallback(
    (index: number) => {
      const updated = additionalConditions.filter((_, i) => i !== index);
      onUpdate({ additional_conditions: updated.length > 0 ? updated : null });
    },
    [additionalConditions, onUpdate]
  );

  // Get field label by ID
  const getFieldLabel = (fieldId: string): string => {
    const f = allFields.find((field) => field.id === fieldId);
    return f?.label || 'Champ inconnu';
  };

  // Check if we have any conditions set
  const hasConditions = field.condition_field_id !== null || additionalConditions.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Conditions d'affichage</h4>
        </div>
        {hasConditions && (
          <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
            <GitBranch className="h-3 w-3 mr-1" />
            Conditionnel
          </Badge>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Définissez quand ce champ doit être affiché en fonction des valeurs d'autres champs.
      </p>

      {/* Main condition */}
      <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
        <Label className="text-xs font-medium">Condition principale</Label>

        <div className="space-y-2">
          <Select
            value={field.condition_field_id || '__none__'}
            onValueChange={(v) => handleMainConditionChange('condition_field_id', v)}
            disabled={disabled}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Sélectionnez un champ..." />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="__none__">Aucune condition (toujours visible)</SelectItem>
              {availableFields.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {field.condition_field_id && (
            <>
              <Select
                value={field.condition_operator || 'equals'}
                onValueChange={(v) =>
                  handleMainConditionChange('condition_operator', v as ConditionOperator)
                }
                disabled={disabled}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {Object.entries(CONDITION_OPERATOR_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Value input (not needed for is_empty/not_empty) */}
              {!['is_empty', 'not_empty'].includes(field.condition_operator || '') && (
                  <Input
                    value={field.condition_value || ''}
                    onChange={(e) => handleMainConditionChange('condition_value', e.target.value)}
                    disabled={disabled}
                    placeholder="Valeur attendue"
                    className="text-sm"
                  />
                )}
            </>
          )}
        </div>
      </div>

      {/* Additional conditions */}
      {field.condition_field_id && (
        <>
          {/* Logic selector */}
          {additionalConditions.length > 0 && (
            <div className="flex items-center gap-2">
              <Label className="text-xs">Logique de combinaison :</Label>
              <div className="flex rounded-md border overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleLogicChange('AND')}
                  disabled={disabled}
                  className={cn(
                    'px-3 py-1 text-xs font-medium transition-colors',
                    field.conditions_logic === 'AND' || !field.conditions_logic
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  )}
                >
                  ET
                </button>
                <button
                  type="button"
                  onClick={() => handleLogicChange('OR')}
                  disabled={disabled}
                  className={cn(
                    'px-3 py-1 text-xs font-medium transition-colors',
                    field.conditions_logic === 'OR'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  )}
                >
                  OU
                </button>
              </div>
            </div>
          )}

          {/* Additional conditions list */}
          <div className="space-y-2">
            {additionalConditions.map((condition, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 bg-muted/20 rounded-md border"
              >
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <Select
                    value={condition.field_id}
                    onValueChange={(v) => updateCondition(index, 'field_id', v)}
                    disabled={disabled}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {availableFields.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={condition.operator}
                    onValueChange={(v) => updateCondition(index, 'operator', v)}
                    disabled={disabled}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {Object.entries(CONDITION_OPERATOR_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {!['is_empty', 'not_empty'].includes(condition.operator) && (
                    <Input
                      value={condition.value}
                      onChange={(e) => updateCondition(index, 'value', e.target.value)}
                      disabled={disabled}
                      placeholder="Valeur"
                      className="text-xs"
                    />
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => removeCondition(index)}
                  disabled={disabled}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          {/* Add condition button */}
          <Button
            variant="outline"
            size="sm"
            onClick={addCondition}
            disabled={disabled || availableFields.length === 0}
            className="w-full"
          >
            <Plus className="h-3.5 w-3.5 mr-2" />
            Ajouter une condition
          </Button>
        </>
      )}

      {/* Preview summary */}
      {hasConditions && (
        <>
          <Separator />
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">Résumé de la règle :</p>
                <p>
                  Ce champ sera affiché{' '}
                  {field.condition_field_id && (
                    <span>
                      si "{getFieldLabel(field.condition_field_id)}"{' '}
                      {CONDITION_OPERATOR_LABELS[field.condition_operator as ConditionOperator]?.toLowerCase() ||
                        '='}{' '}
                      {!['is_empty', 'not_empty'].includes(field.condition_operator || '') && (
                          <span>"{field.condition_value}"</span>
                        )}
                    </span>
                  )}
                  {additionalConditions.length > 0 && (
                    <span>
                      {' '}
                      <strong>{field.conditions_logic === 'OR' ? 'OU' : 'ET'}</strong>{' '}
                      {additionalConditions.length} autre(s) condition(s)
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
});
