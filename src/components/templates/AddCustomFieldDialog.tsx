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
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  CustomFieldType,
  FIELD_TYPE_LABELS,
  FieldOption,
  FieldScope,
} from '@/types/customField';
import { useTableLookupConfigs } from '@/hooks/useTableLookupConfigs';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2 } from 'lucide-react';
import { RepeatableTableColumnsEditor } from './RepeatableTableColumnsEditor';

interface AddCustomFieldDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultProcessId?: string | null;
  defaultSubProcessId?: string | null;
}

export function AddCustomFieldDialog({
  open,
  onClose,
  onSuccess,
  defaultProcessId,
  defaultSubProcessId,
}: AddCustomFieldDialogProps) {
  const { user } = useAuth();
  const { activeConfigs } = useTableLookupConfigs();
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
  
  // Table lookup configuration - now uses config ID
  const [lookupConfigId, setLookupConfigId] = useState<string | null>(null);

  // Scope
  const [scope, setScope] = useState<FieldScope>(
    defaultSubProcessId ? 'sub_process' : defaultProcessId ? 'process' : 'common'
  );
  const [processId, setProcessId] = useState<string | null>(defaultProcessId || null);
  const [subProcessId, setSubProcessId] = useState<string | null>(defaultSubProcessId || null);

  // Lists for selects
  const [processes, setProcesses] = useState<{ id: string; name: string }[]>([]);
  const [subProcesses, setSubProcesses] = useState<{ id: string; name: string; process_template_id: string }[]>([]);

  useEffect(() => {
    if (open) {
      fetchProcesses();
      fetchSubProcesses();
    }
  }, [open]);

  useEffect(() => {
    // Reset subprocess when process changes
    if (scope === 'process') {
      setSubProcessId(null);
    }
  }, [processId, scope]);

  const fetchProcesses = async () => {
    const { data } = await supabase
      .from('process_templates')
      .select('id, name')
      .order('name');
    setProcesses(data || []);
  };

  const fetchSubProcesses = async () => {
    const { data } = await supabase
      .from('sub_process_templates')
      .select('id, name, process_template_id')
      .order('name');
    setSubProcesses(data || []);
  };

  const resetForm = () => {
    setName('');
    setLabel('');
    setFieldType('text');
    setDescription('');
    setIsRequired(false);
    setPlaceholder('');
    setDefaultValue('');
    setOptions([]);
    setScope(defaultSubProcessId ? 'sub_process' : defaultProcessId ? 'process' : 'common');
    setProcessId(defaultProcessId || null);
    setSubProcessId(defaultSubProcessId || null);
    setLookupConfigId(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const addOption = () => {
    setOptions([...options, { value: '', label: '' }]);
  };

  const updateOption = (index: number, field: 'value' | 'label', val: string) => {
    const updated = [...options];
    updated[index][field] = val;
    setOptions(updated);
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !label.trim()) {
      toast.error('Le nom et le libellé sont requis');
      return;
    }

    setIsSubmitting(true);
    try {
      // Get current profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      const insertData: any = {
        name: name.trim(),
        label: label.trim(),
        field_type: fieldType,
        description: description.trim() || null,
        is_required: isRequired,
        placeholder: placeholder.trim() || null,
        default_value: defaultValue.trim() || null,
        options: ['select', 'multiselect'].includes(fieldType)
          ? options.filter(o => o.value && o.label)
          : fieldType === 'repeatable_table'
            ? options.filter(o => o.value && o.label)
            : null,
        is_common: scope === 'common',
        process_template_id: scope === 'process' ? processId : null,
        sub_process_template_id: scope === 'sub_process' ? subProcessId : null,
        created_by: profile?.id || null,
        order_index: 0,
        // Table lookup configuration - get from selected config
        lookup_table: fieldType === 'table_lookup' && lookupConfigId ? activeConfigs.find(c => c.id === lookupConfigId)?.table_name : null,
        lookup_value_column: fieldType === 'table_lookup' && lookupConfigId ? activeConfigs.find(c => c.id === lookupConfigId)?.value_column : null,
        lookup_label_column: fieldType === 'table_lookup' && lookupConfigId ? activeConfigs.find(c => c.id === lookupConfigId)?.display_column : null,
      };

      const { error } = await supabase.from('template_custom_fields').insert(insertData);

      if (error) throw error;

      toast.success('Champ créé avec succès');
      resetForm();
      onSuccess();
    } catch (error: any) {
      console.error('Error creating field:', error);
      toast.error(error.message || 'Erreur lors de la création');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSubProcesses = processId
    ? subProcesses.filter((sp) => sp.process_template_id === processId)
    : subProcesses;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau champ personnalisé</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom technique *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value.replace(/\s+/g, '_').toLowerCase())}
                placeholder="code_projet"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="label">Libellé affiché *</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Code projet"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
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
                  {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex items-end">
              <div className="flex items-center gap-2">
                <Switch id="required" checked={isRequired} onCheckedChange={setIsRequired} />
                <Label htmlFor="required">Champ obligatoire</Label>
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

          {/* Repeatable table columns configuration */}
          {fieldType === 'repeatable_table' && (
            <RepeatableTableColumnsEditor
              columns={options}
              onChange={setOptions}
            />
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
              <Label htmlFor="placeholder">Placeholder</Label>
              <Input
                id="placeholder"
                value={placeholder}
                onChange={(e) => setPlaceholder(e.target.value)}
                placeholder="Entrez..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default">Valeur par défaut</Label>
              <Input
                id="default"
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
              />
            </div>
          </div>

          {/* Scope Selection */}
          <div className="space-y-4">
            <Label>Portée du champ</Label>
            <Tabs value={scope} onValueChange={(v) => setScope(v as FieldScope)}>
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="common">Commun à tous</TabsTrigger>
                <TabsTrigger value="process">Processus</TabsTrigger>
                <TabsTrigger value="sub_process">Sous-processus</TabsTrigger>
              </TabsList>

              <TabsContent value="common" className="mt-4">
                <p className="text-sm text-muted-foreground">
                  Ce champ sera disponible dans toutes les demandes, quel que soit le processus.
                </p>
              </TabsContent>

              <TabsContent value="process" className="mt-4">
                <div className="space-y-2">
                  <Label>Processus associé</Label>
                  <Select value={processId || ''} onValueChange={setProcessId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un processus" />
                    </SelectTrigger>
                    <SelectContent>
                      {processes.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="sub_process" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label>Processus parent (optionnel)</Label>
                  <Select value={processId || '__all__'} onValueChange={(v) => setProcessId(v === '__all__' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tous les processus" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Tous</SelectItem>
                      {processes.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sous-processus associé *</Label>
                  <Select value={subProcessId || ''} onValueChange={setSubProcessId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un sous-processus" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSubProcesses.map((sp) => (
                        <SelectItem key={sp.id} value={sp.id}>
                          {sp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Création...' : 'Créer le champ'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
