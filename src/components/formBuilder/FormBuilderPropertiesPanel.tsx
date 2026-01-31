import { memo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Layers,
  Type,
  Settings2,
  Eye,
  Shield,
  Trash2,
  LayoutGrid,
} from 'lucide-react';
import type { FormSection, FormField, ValidationType } from '@/types/formBuilder';
import { VALIDATION_TYPE_LABELS, CONDITION_OPERATOR_LABELS, ConditionOperator } from '@/types/formBuilder';
import { FIELD_TYPE_LABELS } from '@/types/customField';
import { cn } from '@/lib/utils';

interface FormBuilderPropertiesPanelProps {
  selectedSection: FormSection | null;
  selectedField: FormField | null;
  allFields: FormField[];
  allSections: FormSection[];
  onUpdateSection: (id: string, updates: Partial<FormSection>) => void;
  onUpdateField: (id: string, updates: Partial<FormField>) => void;
  onDeleteSection: (id: string) => void;
  onDeleteField: (id: string) => void;
}

export const FormBuilderPropertiesPanel = memo(
  function FormBuilderPropertiesPanel({
    selectedSection,
    selectedField,
    allFields,
    allSections,
    onUpdateSection,
    onUpdateField,
    onDeleteSection,
    onDeleteField,
  }: FormBuilderPropertiesPanelProps) {
    const hasSelection = selectedSection || selectedField;

    if (!hasSelection) {
      return (
        <div className="w-80 border-l bg-card p-4">
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
            <Settings2 className="h-12 w-12 mb-4 opacity-30" />
            <h3 className="font-medium mb-2">Propriétés</h3>
            <p className="text-sm">
              Sélectionnez une section ou un champ pour modifier ses propriétés
            </p>
          </div>
        </div>
      );
    }

    if (selectedSection) {
      return (
        <SectionProperties
          section={selectedSection}
          allFields={allFields}
          onUpdate={onUpdateSection}
          onDelete={onDeleteSection}
        />
      );
    }

    if (selectedField) {
      return (
        <FieldProperties
          field={selectedField}
          allFields={allFields}
          allSections={allSections}
          onUpdate={onUpdateField}
          onDelete={onDeleteField}
        />
      );
    }

    return null;
  }
);

// Section Properties Component
interface SectionPropertiesProps {
  section: FormSection;
  allFields: FormField[];
  onUpdate: (id: string, updates: Partial<FormSection>) => void;
  onDelete: (id: string) => void;
}

function SectionProperties({
  section,
  allFields,
  onUpdate,
  onDelete,
}: SectionPropertiesProps) {
  const [localSection, setLocalSection] = useState(section);

  useEffect(() => {
    setLocalSection(section);
  }, [section]);

  const handleChange = (key: keyof FormSection, value: any) => {
    setLocalSection((prev) => ({ ...prev, [key]: value }));
  };

  const handleBlur = () => {
    onUpdate(section.id, localSection);
  };

  return (
    <div className="w-80 border-l bg-card flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Section</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={() => onDelete(section.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Basic Info */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="section-name">Nom technique</Label>
              <Input
                id="section-name"
                value={localSection.name}
                onChange={(e) => handleChange('name', e.target.value)}
                onBlur={handleBlur}
                placeholder="section_info"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="section-label">Libellé affiché</Label>
              <Input
                id="section-label"
                value={localSection.label}
                onChange={(e) => handleChange('label', e.target.value)}
                onBlur={handleBlur}
                placeholder="Informations générales"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="section-description">Description</Label>
              <Textarea
                id="section-description"
                value={localSection.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                onBlur={handleBlur}
                placeholder="Description optionnelle..."
                rows={2}
              />
            </div>
          </div>

          <Separator />

          {/* Behavior */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Comportement</h4>

            <div className="flex items-center justify-between">
              <Label htmlFor="is-collapsible" className="text-sm">
                Section repliable
              </Label>
              <Switch
                id="is-collapsible"
                checked={localSection.is_collapsible}
                onCheckedChange={(v) => {
                  handleChange('is_collapsible', v);
                  onUpdate(section.id, { ...localSection, is_collapsible: v });
                }}
              />
            </div>

            {localSection.is_collapsible && (
              <div className="flex items-center justify-between">
                <Label htmlFor="collapsed-default" className="text-sm">
                  Repliée par défaut
                </Label>
                <Switch
                  id="collapsed-default"
                  checked={localSection.is_collapsed_by_default}
                  onCheckedChange={(v) => {
                    handleChange('is_collapsed_by_default', v);
                    onUpdate(section.id, {
                      ...localSection,
                      is_collapsed_by_default: v,
                    });
                  }}
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Conditional Display */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Affichage conditionnel</h4>

            <div className="space-y-2">
              <Label>Afficher si le champ...</Label>
              <Select
                value={localSection.condition_field_id || '__none__'}
                onValueChange={(v) => {
                  const fieldId = v === '__none__' ? null : v;
                  handleChange('condition_field_id', fieldId);
                  onUpdate(section.id, {
                    ...localSection,
                    condition_field_id: fieldId,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Toujours visible" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="__none__">Toujours visible</SelectItem>
                  {allFields.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {localSection.condition_field_id && (
              <>
                <div className="space-y-2">
                  <Label>Opérateur</Label>
                  <Select
                    value={localSection.condition_operator || 'equals'}
                    onValueChange={(v) => {
                      handleChange('condition_operator', v);
                      onUpdate(section.id, {
                        ...localSection,
                        condition_operator: v as ConditionOperator,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {Object.entries(CONDITION_OPERATOR_LABELS).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {!['is_empty', 'not_empty'].includes(
                  localSection.condition_operator || ''
                ) && (
                  <div className="space-y-2">
                    <Label>Valeur</Label>
                    <Input
                      value={localSection.condition_value || ''}
                      onChange={(e) =>
                        handleChange('condition_value', e.target.value)
                      }
                      onBlur={handleBlur}
                      placeholder="Valeur de comparaison"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// Field Properties Component
interface FieldPropertiesProps {
  field: FormField;
  allFields: FormField[];
  allSections: FormSection[];
  onUpdate: (id: string, updates: Partial<FormField>) => void;
  onDelete: (id: string) => void;
}

function FieldProperties({
  field,
  allFields,
  allSections,
  onUpdate,
  onDelete,
}: FieldPropertiesProps) {
  const [localField, setLocalField] = useState(field);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    setLocalField(field);
  }, [field]);

  const handleChange = (key: keyof FormField, value: any) => {
    setLocalField((prev) => ({ ...prev, [key]: value }));
  };

  const handleBlur = () => {
    onUpdate(field.id, localField);
  };

  const otherFields = allFields.filter((f) => f.id !== field.id);

  return (
    <div className="w-80 border-l bg-card flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Champ</h3>
            <Badge variant="secondary" className="text-[10px]">
              {FIELD_TYPE_LABELS[field.field_type]}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={() => onDelete(field.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col"
      >
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-9 p-0">
          <TabsTrigger
            value="general"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary h-9 px-3"
          >
            Général
          </TabsTrigger>
          <TabsTrigger
            value="layout"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary h-9 px-3"
          >
            Layout
          </TabsTrigger>
          <TabsTrigger
            value="validation"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary h-9 px-3"
          >
            Validation
          </TabsTrigger>
          <TabsTrigger
            value="conditions"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary h-9 px-3"
          >
            Conditions
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <TabsContent value="general" className="p-4 space-y-4 mt-0">
            <div className="space-y-2">
              <Label htmlFor="field-name">Nom technique</Label>
              <Input
                id="field-name"
                value={localField.name}
                onChange={(e) => handleChange('name', e.target.value)}
                onBlur={handleBlur}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="field-label">Libellé</Label>
              <Input
                id="field-label"
                value={localField.label}
                onChange={(e) => handleChange('label', e.target.value)}
                onBlur={handleBlur}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="field-description">Description</Label>
              <Textarea
                id="field-description"
                value={localField.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                onBlur={handleBlur}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="field-placeholder">Placeholder</Label>
              <Input
                id="field-placeholder"
                value={localField.placeholder || ''}
                onChange={(e) => handleChange('placeholder', e.target.value)}
                onBlur={handleBlur}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="field-default">Valeur par défaut</Label>
              <Input
                id="field-default"
                value={localField.default_value || ''}
                onChange={(e) => handleChange('default_value', e.target.value)}
                onBlur={handleBlur}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is-required">Obligatoire</Label>
              <Switch
                id="is-required"
                checked={localField.is_required}
                onCheckedChange={(v) => {
                  handleChange('is_required', v);
                  onUpdate(field.id, { ...localField, is_required: v });
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="layout" className="p-4 space-y-4 mt-0">
            <div className="space-y-2">
              <Label>Section</Label>
              <Select
                value={localField.section_id || '__none__'}
                onValueChange={(v) => {
                  const sectionId = v === '__none__' ? null : v;
                  handleChange('section_id', sectionId);
                  onUpdate(field.id, { ...localField, section_id: sectionId });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucune section" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="__none__">Hors section</SelectItem>
                  {allSections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Largeur (colonnes)</Label>
              <Select
                value={String(localField.column_span || 1)}
                onValueChange={(v) => {
                  const span = parseInt(v, 10);
                  handleChange('column_span', span);
                  onUpdate(field.id, { ...localField, column_span: span });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="1">1 colonne (25%)</SelectItem>
                  <SelectItem value="2">2 colonnes (50%)</SelectItem>
                  <SelectItem value="3">3 colonnes (75%)</SelectItem>
                  <SelectItem value="4">4 colonnes (100%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="row-index">Ligne</Label>
                <Input
                  id="row-index"
                  type="number"
                  min={0}
                  value={localField.row_index ?? ''}
                  onChange={(e) =>
                    handleChange(
                      'row_index',
                      e.target.value ? parseInt(e.target.value, 10) : null
                    )
                  }
                  onBlur={handleBlur}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="col-index">Colonne</Label>
                <Input
                  id="col-index"
                  type="number"
                  min={0}
                  max={3}
                  value={localField.column_index}
                  onChange={(e) =>
                    handleChange('column_index', parseInt(e.target.value, 10))
                  }
                  onBlur={handleBlur}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="validation" className="p-4 space-y-4 mt-0">
            <div className="space-y-2">
              <Label>Type de validation</Label>
              <Select
                value={localField.validation_type || '__none__'}
                onValueChange={(v) => {
                  const validationType = v === '__none__' ? null : v;
                  handleChange('validation_type', validationType);
                  onUpdate(field.id, {
                    ...localField,
                    validation_type: validationType as ValidationType | null,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucune validation spécifique" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="__none__">Aucune</SelectItem>
                  {Object.entries(VALIDATION_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {localField.validation_type === 'regex' && (
              <div className="space-y-2">
                <Label htmlFor="validation-regex">Expression régulière</Label>
                <Input
                  id="validation-regex"
                  value={localField.validation_regex || ''}
                  onChange={(e) =>
                    handleChange('validation_regex', e.target.value)
                  }
                  onBlur={handleBlur}
                  placeholder="^[A-Z]{2}[0-9]{4}$"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="validation-message">Message d'erreur</Label>
              <Textarea
                id="validation-message"
                value={localField.validation_message || ''}
                onChange={(e) =>
                  handleChange('validation_message', e.target.value)
                }
                onBlur={handleBlur}
                placeholder="Format invalide"
                rows={2}
              />
            </div>

            {localField.field_type === 'number' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="min-value">Valeur min</Label>
                  <Input
                    id="min-value"
                    type="number"
                    value={localField.min_value ?? ''}
                    onChange={(e) =>
                      handleChange(
                        'min_value',
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    onBlur={handleBlur}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-value">Valeur max</Label>
                  <Input
                    id="max-value"
                    type="number"
                    value={localField.max_value ?? ''}
                    onChange={(e) =>
                      handleChange(
                        'max_value',
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    onBlur={handleBlur}
                  />
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="conditions" className="p-4 space-y-4 mt-0">
            <div className="space-y-2">
              <Label>Afficher si le champ...</Label>
              <Select
                value={localField.condition_field_id || '__none__'}
                onValueChange={(v) => {
                  const fieldId = v === '__none__' ? null : v;
                  handleChange('condition_field_id', fieldId);
                  onUpdate(field.id, {
                    ...localField,
                    condition_field_id: fieldId,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Toujours visible" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="__none__">Toujours visible</SelectItem>
                  {otherFields.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {localField.condition_field_id && (
              <>
                <div className="space-y-2">
                  <Label>Opérateur</Label>
                  <Select
                    value={localField.condition_operator || 'equals'}
                    onValueChange={(v) => {
                      handleChange('condition_operator', v);
                      onUpdate(field.id, {
                        ...localField,
                        condition_operator: v as any,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {Object.entries(CONDITION_OPERATOR_LABELS).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {!['is_empty', 'not_empty'].includes(
                  localField.condition_operator || ''
                ) && (
                  <div className="space-y-2">
                    <Label>Valeur</Label>
                    <Input
                      value={localField.condition_value || ''}
                      onChange={(e) =>
                        handleChange('condition_value', e.target.value)
                      }
                      onBlur={handleBlur}
                      placeholder="Valeur de comparaison"
                    />
                  </div>
                )}
              </>
            )}

            {localField.condition_field_id && (
              <div className="space-y-2">
                <Label>Logique de combinaison</Label>
                <Select
                  value={localField.conditions_logic || 'AND'}
                  onValueChange={(v) => {
                    handleChange('conditions_logic', v);
                    onUpdate(field.id, {
                      ...localField,
                      conditions_logic: v as 'AND' | 'OR',
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="AND">ET (toutes les conditions)</SelectItem>
                    <SelectItem value="OR">OU (au moins une)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
