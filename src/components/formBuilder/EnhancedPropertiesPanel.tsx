import { memo, useState, useEffect, useCallback } from 'react';
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Layers,
  Type,
  Settings2,
  Eye,
  Shield,
  Trash2,
  LayoutGrid,
  Variable,
  Lock,
  EyeOff,
  Palette,
  Link2,
  Save,
  Loader2,
} from 'lucide-react';
import type { FormSection, FormField, ValidationType, ConditionOperator } from '@/types/formBuilder';
import { VALIDATION_TYPE_LABELS, CONDITION_OPERATOR_LABELS } from '@/types/formBuilder';
import { FIELD_TYPE_LABELS } from '@/types/customField';
import { ValidationPropertiesPanel } from './ValidationPropertiesPanel';
import { cn } from '@/lib/utils';

interface EnhancedPropertiesPanelProps {
  selectedSection: FormSection | null;
  selectedField: FormField | null;
  allFields: FormField[];
  allSections: FormSection[];
  onUpdateSection: (id: string, updates: Partial<FormSection>) => Promise<boolean>;
  onUpdateField: (id: string, updates: Partial<FormField>) => Promise<boolean>;
  onDeleteSection: (id: string) => Promise<boolean>;
  onDeleteField: (id: string) => void;
  canManage: boolean;
}

export const EnhancedPropertiesPanel = memo(function EnhancedPropertiesPanel({
  selectedSection,
  selectedField,
  allFields,
  allSections,
  onUpdateSection,
  onUpdateField,
  onDeleteSection,
  onDeleteField,
  canManage,
}: EnhancedPropertiesPanelProps) {
  const [localSection, setLocalSection] = useState<FormSection | null>(null);
  const [localField, setLocalField] = useState<FormField | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync with selected items
  useEffect(() => {
    setLocalSection(selectedSection);
    setHasChanges(false);
  }, [selectedSection]);

  useEffect(() => {
    setLocalField(selectedField);
    setHasChanges(false);
  }, [selectedField]);

  // Handle section changes
  const handleSectionChange = useCallback(
    (key: keyof FormSection, value: any) => {
      if (!localSection) return;
      setLocalSection((prev) => (prev ? { ...prev, [key]: value } : null));
      setHasChanges(true);
    },
    [localSection]
  );

  // Handle field changes
  const handleFieldChange = useCallback(
    (key: keyof FormField, value: any) => {
      if (!localField) return;
      setLocalField((prev) => (prev ? { ...prev, [key]: value } : null));
      setHasChanges(true);
    },
    [localField]
  );

  // Save section
  const saveSection = useCallback(async () => {
    if (!localSection || !selectedSection) return;
    setIsSaving(true);
    try {
      await onUpdateSection(selectedSection.id, localSection);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  }, [localSection, selectedSection, onUpdateSection]);

  // Save field
  const saveField = useCallback(async () => {
    if (!localField || !selectedField) return;
    setIsSaving(true);
    try {
      await onUpdateField(selectedField.id, localField);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  }, [localField, selectedField, onUpdateField]);

  // Auto-save on blur
  const handleBlur = useCallback(() => {
    if (hasChanges) {
      if (localSection && selectedSection) {
        saveSection();
      } else if (localField && selectedField) {
        saveField();
      }
    }
  }, [hasChanges, localSection, localField, selectedSection, selectedField, saveSection, saveField]);

  // Empty state
  if (!selectedSection && !selectedField) {
    return (
      <div className="w-80 border-l bg-card flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center text-muted-foreground">
            <Settings2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-sm">Sélectionnez un élément pour voir ses propriétés</p>
          </div>
        </div>
      </div>
    );
  }

  // Section properties
  if (localSection) {
    return (
      <div className="w-80 border-l bg-card flex flex-col h-full">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Section</span>
          </div>
          {hasChanges && (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
              Non enregistré
            </Badge>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Basic info */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="section-label">Titre</Label>
                <Input
                  id="section-label"
                  value={localSection.label}
                  onChange={(e) => handleSectionChange('label', e.target.value)}
                  onBlur={handleBlur}
                  disabled={!canManage}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="section-name">Identifiant technique</Label>
                <Input
                  id="section-name"
                  value={localSection.name}
                  onChange={(e) => handleSectionChange('name', e.target.value)}
                  onBlur={handleBlur}
                  disabled={!canManage}
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="section-description">Description</Label>
                <Textarea
                  id="section-description"
                  value={localSection.description || ''}
                  onChange={(e) => handleSectionChange('description', e.target.value)}
                  onBlur={handleBlur}
                  disabled={!canManage}
                  rows={2}
                />
              </div>
            </div>

            <Separator />

            {/* Display options */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                Affichage
              </h4>

              <div className="flex items-center justify-between">
                <Label htmlFor="section-collapsible" className="text-sm">
                  Repliable
                </Label>
                <Switch
                  id="section-collapsible"
                  checked={localSection.is_collapsible}
                  onCheckedChange={(v) => handleSectionChange('is_collapsible', v)}
                  disabled={!canManage}
                />
              </div>

              {localSection.is_collapsible && (
                <div className="flex items-center justify-between">
                  <Label htmlFor="section-collapsed" className="text-sm">
                    Replié par défaut
                  </Label>
                  <Switch
                    id="section-collapsed"
                    checked={localSection.is_collapsed_by_default}
                    onCheckedChange={(v) => handleSectionChange('is_collapsed_by_default', v)}
                    disabled={!canManage}
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label htmlFor="section-common" className="text-sm">
                  Section commune
                </Label>
                <Switch
                  id="section-common"
                  checked={localSection.is_common}
                  onCheckedChange={(v) => handleSectionChange('is_common', v)}
                  disabled={!canManage}
                />
              </div>
            </div>

            <Separator />

            {/* Conditions */}
            <Accordion type="single" collapsible>
              <AccordionItem value="conditions">
                <AccordionTrigger className="text-sm py-2">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Conditions d'affichage
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Afficher si le champ</Label>
                    <Select
                      value={localSection.condition_field_id || '__none__'}
                      onValueChange={(v) =>
                        handleSectionChange('condition_field_id', v === '__none__' ? null : v)
                      }
                      disabled={!canManage}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Aucune condition" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="__none__">Aucune condition</SelectItem>
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
                        <Label className="text-xs">Opérateur</Label>
                        <Select
                          value={localSection.condition_operator || 'equals'}
                          onValueChange={(v) =>
                            handleSectionChange('condition_operator', v as ConditionOperator)
                          }
                          disabled={!canManage}
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
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Valeur</Label>
                        <Input
                          value={localSection.condition_value || ''}
                          onChange={(e) => handleSectionChange('condition_value', e.target.value)}
                          onBlur={handleBlur}
                          disabled={!canManage}
                          placeholder="Valeur attendue"
                        />
                      </div>
                    </>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Delete button */}
            {canManage && (
              <>
                <Separator />
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => onDeleteSection(localSection.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer la section
                </Button>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Save button */}
        {canManage && hasChanges && (
          <div className="p-3 border-t">
            <Button onClick={saveSection} disabled={isSaving} className="w-full">
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Enregistrer
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Field properties
  if (localField) {
    return (
      <div className="w-80 border-l bg-card flex flex-col h-full">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Champ</span>
            <Badge variant="secondary" className="text-xs">
              {FIELD_TYPE_LABELS[localField.field_type]}
            </Badge>
          </div>
          {hasChanges && (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
              Non enregistré
            </Badge>
          )}
        </div>

        <Tabs defaultValue="general" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-4 mx-3 mt-2">
            <TabsTrigger value="general" className="text-xs px-2">
              <Settings2 className="h-3 w-3" />
            </TabsTrigger>
            <TabsTrigger value="layout" className="text-xs px-2">
              <LayoutGrid className="h-3 w-3" />
            </TabsTrigger>
            <TabsTrigger value="validation" className="text-xs px-2">
              <Shield className="h-3 w-3" />
            </TabsTrigger>
            <TabsTrigger value="advanced" className="text-xs px-2">
              <Variable className="h-3 w-3" />
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            {/* General Tab */}
            <TabsContent value="general" className="p-4 space-y-4 mt-0">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="field-label">Libellé</Label>
                  <Input
                    id="field-label"
                    value={localField.label}
                    onChange={(e) => handleFieldChange('label', e.target.value)}
                    onBlur={handleBlur}
                    disabled={!canManage}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="field-name">Identifiant technique</Label>
                  <Input
                    id="field-name"
                    value={localField.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    onBlur={handleBlur}
                    disabled={!canManage}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="field-description">Aide / Description</Label>
                  <Textarea
                    id="field-description"
                    value={localField.description || ''}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    onBlur={handleBlur}
                    disabled={!canManage}
                    rows={2}
                    placeholder="Texte d'aide affiché sous le champ"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="field-placeholder">Placeholder</Label>
                  <Input
                    id="field-placeholder"
                    value={localField.placeholder || ''}
                    onChange={(e) => handleFieldChange('placeholder', e.target.value)}
                    onBlur={handleBlur}
                    disabled={!canManage}
                    placeholder="Texte indicatif dans le champ vide"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="field-default">Valeur par défaut</Label>
                  <Input
                    id="field-default"
                    value={localField.default_value || ''}
                    onChange={(e) => handleFieldChange('default_value', e.target.value)}
                    onBlur={handleBlur}
                    disabled={!canManage}
                  />
                </div>
              </div>

              <Separator />

              {/* State toggles */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">État</h4>

                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-sm">
                    <span className="text-destructive">*</span> Obligatoire
                  </Label>
                  <Switch
                    checked={localField.is_required}
                    onCheckedChange={(v) => handleFieldChange('is_required', v)}
                    disabled={!canManage}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-sm">
                    <Lock className="h-3 w-3" /> Lecture seule
                  </Label>
                  <Switch
                    checked={(localField as any).is_readonly || false}
                    onCheckedChange={(v) => handleFieldChange('is_readonly' as any, v)}
                    disabled={!canManage}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-sm">
                    <EyeOff className="h-3 w-3" /> Masqué
                  </Label>
                  <Switch
                    checked={(localField as any).is_hidden || false}
                    onCheckedChange={(v) => handleFieldChange('is_hidden' as any, v)}
                    disabled={!canManage}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-sm">
                    <Palette className="h-3 w-3" /> Champ commun
                  </Label>
                  <Switch
                    checked={localField.is_common}
                    onCheckedChange={(v) => handleFieldChange('is_common', v)}
                    disabled={!canManage}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Layout Tab */}
            <TabsContent value="layout" className="p-4 space-y-4 mt-0">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Section</Label>
                  <Select
                    value={localField.section_id || '__none__'}
                    onValueChange={(v) =>
                      handleFieldChange('section_id', v === '__none__' ? null : v)
                    }
                    disabled={!canManage}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sans section" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="__none__">Sans section</SelectItem>
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
                    onValueChange={(v) => handleFieldChange('column_span', parseInt(v, 10))}
                    disabled={!canManage}
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
                    <Label>Ligne</Label>
                    <Input
                      type="number"
                      min={0}
                      value={localField.row_index ?? 0}
                      onChange={(e) =>
                        handleFieldChange('row_index', parseInt(e.target.value, 10) || 0)
                      }
                      onBlur={handleBlur}
                      disabled={!canManage}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Colonne</Label>
                    <Input
                      type="number"
                      min={0}
                      max={3}
                      value={localField.column_index}
                      onChange={(e) =>
                        handleFieldChange('column_index', parseInt(e.target.value, 10) || 0)
                      }
                      onBlur={handleBlur}
                      disabled={!canManage}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Ordre d'affichage</Label>
                  <Input
                    type="number"
                    min={0}
                    value={localField.order_index}
                    onChange={(e) =>
                      handleFieldChange('order_index', parseInt(e.target.value, 10) || 0)
                    }
                    onBlur={handleBlur}
                    disabled={!canManage}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Validation Tab */}
            <TabsContent value="validation" className="p-4 mt-0">
              <ValidationPropertiesPanel
                field={localField}
                onUpdate={(updates) => {
                  Object.entries(updates).forEach(([key, value]) => {
                    handleFieldChange(key as keyof FormField, value);
                  });
                }}
              />
            </TabsContent>

            {/* Advanced Tab */}
            <TabsContent value="advanced" className="p-4 space-y-4 mt-0">
              {/* Variable mapping */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                  <Variable className="h-3 w-3" />
                  Mapping variable
                </h4>
                <p className="text-xs text-muted-foreground">
                  Permet de récupérer la valeur dans les workflows et notifications.
                </p>
                <div className="p-2 bg-muted rounded-md">
                  <code className="text-xs font-mono text-primary">
                    {`{champ:${localField.name}}`}
                  </code>
                </div>
              </div>

              <Separator />

              {/* Conditions */}
              <Accordion type="single" collapsible>
                <AccordionItem value="conditions">
                  <AccordionTrigger className="text-sm py-2">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Conditions d'affichage
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-2">
                    <div className="space-y-2">
                      <Label className="text-xs">Afficher si le champ</Label>
                      <Select
                        value={localField.condition_field_id || '__none__'}
                        onValueChange={(v) =>
                          handleFieldChange('condition_field_id', v === '__none__' ? null : v)
                        }
                        disabled={!canManage}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Aucune condition" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover">
                          <SelectItem value="__none__">Aucune condition</SelectItem>
                          {allFields
                            .filter((f) => f.id !== localField.id)
                            .map((f) => (
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
                          <Label className="text-xs">Opérateur</Label>
                          <Select
                            value={localField.condition_operator || 'equals'}
                            onValueChange={(v) =>
                              handleFieldChange('condition_operator', v as ConditionOperator)
                            }
                            disabled={!canManage}
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
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">Valeur</Label>
                          <Input
                            value={localField.condition_value || ''}
                            onChange={(e) => handleFieldChange('condition_value', e.target.value)}
                            onBlur={handleBlur}
                            disabled={!canManage}
                            placeholder="Valeur attendue"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">Logique multi-conditions</Label>
                          <Select
                            value={localField.conditions_logic || 'AND'}
                            onValueChange={(v) =>
                              handleFieldChange('conditions_logic', v as 'AND' | 'OR')
                            }
                            disabled={!canManage}
                          >
                            <SelectTrigger className="text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover">
                              <SelectItem value="AND">ET (toutes vraies)</SelectItem>
                              <SelectItem value="OR">OU (une vraie suffit)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Delete button */}
              {canManage && (
                <>
                  <Separator />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => onDeleteField(localField.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer le champ
                  </Button>
                </>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Save button */}
        {canManage && hasChanges && (
          <div className="p-3 border-t">
            <Button onClick={saveField} disabled={isSaving} className="w-full">
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Enregistrer
            </Button>
          </div>
        )}
      </div>
    );
  }

  return null;
});
