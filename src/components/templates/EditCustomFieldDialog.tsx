import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  TemplateCustomField,
  CustomFieldType,
  FIELD_TYPE_LABELS,
  FieldOption,
} from '@/types/customField';
import { useTableLookupConfigs } from '@/hooks/useTableLookupConfigs';
import { useProcessTemplates } from '@/hooks/useProcessTemplates';
import { useAllSubProcessTemplates } from '@/hooks/useAllSubProcessTemplates';
import { Plus, Trash2, Globe, Workflow, GitBranch } from 'lucide-react';

interface EditCustomFieldDialogProps {
  field: TemplateCustomField | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditCustomFieldDialog({
  field,
  open,
  onClose,
  onSuccess,
}: EditCustomFieldDialogProps) {
  const { activeConfigs, configs } = useTableLookupConfigs();
  const { processes } = useProcessTemplates();
  const { subProcesses } = useAllSubProcessTemplates();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState<CustomFieldType>('text');
  const [description, setDescription] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [placeholder, setPlaceholder] = useState('');
  const [defaultValue, setDefaultValue] = useState('');
  const [options, setOptions] = useState<FieldOption[]>([]);
  const [lookupConfigId, setLookupConfigId] = useState<string | null>(null);
  
  // Scope state
  const [scopeType, setScopeType] = useState<'common' | 'process' | 'subprocess'>('common');
  const [processId, setProcessId] = useState<string>('__none__');
  const [subProcessId, setSubProcessId] = useState<string>('__none__');

  useEffect(() => {
    if (field) {
      setName(field.name);
      setLabel(field.label);
      setFieldType(field.field_type);
      setDescription(field.description || '');
      setIsRequired(field.is_required);
      setPlaceholder(field.placeholder || '');
      setDefaultValue(field.default_value || '');
      setOptions(field.options || []);
      
      // Find matching config by table/columns
      const matchingConfig = configs.find(
        c => c.table_name === field.lookup_table && 
             c.display_column === field.lookup_label_column &&
             c.value_column === field.lookup_value_column
      );
      setLookupConfigId(matchingConfig?.id || null);
      
      // Set scope
      if (field.is_common) {
        setScopeType('common');
        setProcessId('__none__');
        setSubProcessId('__none__');
      } else if (field.sub_process_template_id) {
        setScopeType('subprocess');
        setSubProcessId(field.sub_process_template_id);
        setProcessId('__none__');
      } else if (field.process_template_id) {
        setScopeType('process');
        setProcessId(field.process_template_id);
        setSubProcessId('__none__');
      } else {
        setScopeType('common');
        setProcessId('__none__');
        setSubProcessId('__none__');
      }
    }
  }, [field, configs]);

  const handleClose = () => {
    onClose();
  };

  const addOption = () => {
    setOptions([...options, { value: '', label: '' }]);
  };

  const updateOption = (index: number, optField: 'value' | 'label', val: string) => {
    const updated = [...options];
    updated[index][optField] = val;
    setOptions(updated);
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!field || !name.trim() || !label.trim()) {
      toast.error('Le nom et le libellé sont requis');
      return;
    }

    // Build scope values
    let is_common = false;
    let process_template_id: string | null = null;
    let sub_process_template_id: string | null = null;
    
    if (scopeType === 'common') {
      is_common = true;
    } else if (scopeType === 'process' && processId !== '__none__') {
      process_template_id = processId;
    } else if (scopeType === 'subprocess' && subProcessId !== '__none__') {
      sub_process_template_id = subProcessId;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('template_custom_fields')
        .update({
          name: name.trim(),
          label: label.trim(),
          field_type: fieldType as any,
          description: description.trim() || null,
          is_required: isRequired,
          placeholder: placeholder.trim() || null,
          default_value: defaultValue.trim() || null,
          options: ['select', 'multiselect'].includes(fieldType)
            ? (options.filter((o) => o.value && o.label) as any)
            : null,
          lookup_table: fieldType === 'table_lookup' && lookupConfigId ? activeConfigs.find(c => c.id === lookupConfigId)?.table_name : null,
          lookup_value_column: fieldType === 'table_lookup' && lookupConfigId ? activeConfigs.find(c => c.id === lookupConfigId)?.value_column : null,
          lookup_label_column: fieldType === 'table_lookup' && lookupConfigId ? activeConfigs.find(c => c.id === lookupConfigId)?.display_column : null,
          is_common,
          process_template_id,
          sub_process_template_id,
        })
        .eq('id', field.id);

      if (error) throw error;

      toast.success('Champ mis à jour');
      onSuccess();
    } catch (error: any) {
      console.error('Error updating field:', error);
      toast.error(error.message || 'Erreur lors de la mise à jour');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!field) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le champ personnalisé</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nom technique *</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value.replace(/\s+/g, '_').toLowerCase())}
                placeholder="code_projet"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-label">Libellé affiché *</Label>
              <Input
                id="edit-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Code projet"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description du champ..."
              rows={2}
            />
          </div>

          {/* Type & Validation */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type de champ *</Label>
              <Select value={fieldType} onValueChange={(v) => setFieldType(v as CustomFieldType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FIELD_TYPE_LABELS).map(([value, labelText]) => (
                    <SelectItem key={value} value={value}>
                      {labelText}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex items-end">
              <div className="flex items-center gap-2">
                <Switch id="edit-required" checked={isRequired} onCheckedChange={setIsRequired} />
                <Label htmlFor="edit-required">Champ obligatoire</Label>
              </div>
            </div>
          </div>

          {/* Options for select/multiselect */}
          {['select', 'multiselect'].includes(fieldType) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Options</Label>
                <Button type="button" variant="outline" size="sm" onClick={addOption}>
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter
                </Button>
              </div>
              <div className="space-y-2">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      placeholder="Valeur"
                      value={opt.value}
                      onChange={(e) => updateOption(idx, 'value', e.target.value)}
                    />
                    <Input
                      placeholder="Libellé"
                      value={opt.label}
                      onChange={(e) => updateOption(idx, 'label', e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOption(idx)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {options.length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucune option définie</p>
                )}
              </div>
            </div>
          )}

          {/* Table lookup configuration */}
          {fieldType === 'table_lookup' && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <Label className="text-base font-medium">Configuration de la table source</Label>
              
              <div className="space-y-2">
                <Label>Source de données *</Label>
                <Select value={lookupConfigId || '__none__'} onValueChange={(v) => setLookupConfigId(v === '__none__' ? null : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une source" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="__none__">Sélectionner une source</SelectItem>
                    {activeConfigs.map((config) => (
                      <SelectItem key={config.id} value={config.id}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeConfigs.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Aucune configuration disponible. Configurez les sources dans Administration &gt; Champs table.
                  </p>
                )}
              </div>

              {lookupConfigId && (
                <div className="text-sm text-muted-foreground p-3 bg-background rounded border">
                  {(() => {
                    const config = activeConfigs.find(c => c.id === lookupConfigId);
                    if (!config) return null;
                    return (
                      <>
                        <p><strong>Table :</strong> {config.table_name}</p>
                        <p><strong>Affichage :</strong> {config.display_column}</p>
                        <p><strong>Valeur :</strong> {config.value_column}</p>
                        {config.filter_column && (
                          <p><strong>Filtre :</strong> {config.filter_column} = {config.filter_value}</p>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Placeholder & Default */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-placeholder">Placeholder</Label>
              <Input
                id="edit-placeholder"
                value={placeholder}
                onChange={(e) => setPlaceholder(e.target.value)}
                placeholder="Entrez..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-default">Valeur par défaut</Label>
              <Input
                id="edit-default"
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
              />
            </div>
          </div>

          {/* Scope Selection */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <Label className="text-base font-medium">Portée du champ</Label>
            
            <div className="space-y-2">
              <Label>Type de portée</Label>
              <Select value={scopeType} onValueChange={(v) => setScopeType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="common">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Commun (tous les processus)
                    </div>
                  </SelectItem>
                  <SelectItem value="process">
                    <div className="flex items-center gap-2">
                      <Workflow className="h-4 w-4" />
                      Processus spécifique
                    </div>
                  </SelectItem>
                  <SelectItem value="subprocess">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4" />
                      Sous-processus spécifique
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scopeType === 'process' && (
              <div className="space-y-2">
                <Label>Processus cible</Label>
                <Select value={processId} onValueChange={setProcessId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un processus" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="__none__">Aucun (non lié)</SelectItem>
                    {processes.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scopeType === 'subprocess' && (
              <div className="space-y-2">
                <Label>Sous-processus cible</Label>
                <Select value={subProcessId} onValueChange={setSubProcessId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un sous-processus" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="__none__">Aucun (non lié)</SelectItem>
                    {subProcesses.map((sp) => (
                      <SelectItem key={sp.id} value={sp.id}>
                        {sp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
