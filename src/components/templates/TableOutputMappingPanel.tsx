import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Plus,
  Trash2,
  Loader2,
  Save,
  Database,
  ArrowRight,
  Table2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FieldMapping {
  custom_field_id: string;
  target_column: string;
}

interface StaticMapping {
  target_column: string;
  static_value: string;
}

interface OutputMapping {
  id?: string;
  process_template_id: string | null;
  sub_process_template_id: string | null;
  target_table: string;
  trigger_event: string;
  field_mappings: FieldMapping[];
  static_mappings: StaticMapping[];
  is_active: boolean;
}

interface CustomField {
  id: string;
  label: string;
  name: string;
  field_type: string;
}

interface TableColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

interface TableOutputMappingPanelProps {
  processTemplateId: string | null;
  subProcessTemplateId: string | null;
  canManage: boolean;
  onUpdate?: () => void;
}

export function TableOutputMappingPanel({
  processTemplateId,
  subProcessTemplateId,
  canManage,
  onUpdate,
}: TableOutputMappingPanelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [mapping, setMapping] = useState<OutputMapping | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);

  // Reference data
  const [publicTables, setPublicTables] = useState<{ table_name: string }[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [targetColumns, setTargetColumns] = useState<TableColumn[]>([]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch existing mapping
      let query = supabase
        .from('process_table_output_mappings')
        .select('*')
        .eq('is_active', true);

      if (subProcessTemplateId) {
        query = query.eq('sub_process_template_id', subProcessTemplateId);
      } else if (processTemplateId) {
        query = query.eq('process_template_id', processTemplateId);
      }

      const { data: mappingData } = await query.limit(1).single();

      if (mappingData) {
        setMapping({
          ...mappingData,
          field_mappings: (mappingData.field_mappings as unknown as FieldMapping[]) || [],
          static_mappings: (mappingData.static_mappings as unknown as StaticMapping[]) || [],
        });
        setIsEnabled(true);

        // Fetch target table columns if table is set
        if (mappingData.target_table) {
          await fetchTableColumns(mappingData.target_table);
        }
      } else {
        setMapping(null);
        setIsEnabled(false);
      }

      // Fetch public tables
      const { data: tables } = await supabase.rpc('get_public_tables_info');
      if (tables) {
        setPublicTables(tables.filter((t: any) => 
          !t.table_name.startsWith('_') && 
          !['schema_migrations', 'number_counters'].includes(t.table_name)
        ));
      }

      // Fetch custom fields for this process/sub-process
      const orParts: string[] = [];
      if (processTemplateId) orParts.push(`process_template_id.eq.${processTemplateId}`);
      if (subProcessTemplateId) orParts.push(`sub_process_template_id.eq.${subProcessTemplateId}`);

      if (orParts.length > 0) {
        const { data: fields } = await supabase
          .from('template_custom_fields')
          .select('id, label, name, field_type')
          .or(orParts.join(','))
          .order('order_index');
        if (fields) setCustomFields(fields);
      }
    } catch (error) {
      console.error('Error fetching output mapping:', error);
    } finally {
      setIsLoading(false);
    }
  }, [processTemplateId, subProcessTemplateId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchTableColumns = async (tableName: string) => {
    const { data } = await supabase.rpc('get_table_columns_info', { p_table_name: tableName });
    if (data) {
      setTargetColumns(data.filter((c: TableColumn) => 
        !['id', 'created_at', 'updated_at', 'updated_by'].includes(c.column_name)
      ));
    }
  };

  const handleToggle = (enabled: boolean) => {
    setIsEnabled(enabled);
    if (enabled && !mapping) {
      setMapping({
        process_template_id: processTemplateId,
        sub_process_template_id: subProcessTemplateId,
        target_table: '',
        trigger_event: 'task_done',
        field_mappings: [],
        static_mappings: [],
        is_active: true,
      });
    }
  };

  const handleTableChange = async (tableName: string) => {
    if (!mapping) return;
    setMapping({ ...mapping, target_table: tableName, field_mappings: [], static_mappings: [] });
    await fetchTableColumns(tableName);
  };

  const addFieldMapping = () => {
    if (!mapping) return;
    setMapping({
      ...mapping,
      field_mappings: [...mapping.field_mappings, { custom_field_id: '', target_column: '' }],
    });
  };

  const addStaticMapping = () => {
    if (!mapping) return;
    setMapping({
      ...mapping,
      static_mappings: [...mapping.static_mappings, { target_column: '', static_value: '' }],
    });
  };

  const updateFieldMapping = (index: number, updates: Partial<FieldMapping>) => {
    if (!mapping) return;
    const updated = [...mapping.field_mappings];
    updated[index] = { ...updated[index], ...updates };
    setMapping({ ...mapping, field_mappings: updated });
  };

  const updateStaticMapping = (index: number, updates: Partial<StaticMapping>) => {
    if (!mapping) return;
    const updated = [...mapping.static_mappings];
    updated[index] = { ...updated[index], ...updates };
    setMapping({ ...mapping, static_mappings: updated });
  };

  const removeFieldMapping = (index: number) => {
    if (!mapping) return;
    setMapping({
      ...mapping,
      field_mappings: mapping.field_mappings.filter((_, i) => i !== index),
    });
  };

  const removeStaticMapping = (index: number) => {
    if (!mapping) return;
    setMapping({
      ...mapping,
      static_mappings: mapping.static_mappings.filter((_, i) => i !== index),
    });
  };

  const handleSave = async () => {
    if (!mapping) return;
    setIsSaving(true);

    try {
      if (!isEnabled) {
        // Deactivate existing mapping
        if (mapping.id) {
          await supabase
            .from('process_table_output_mappings')
            .update({ is_active: false })
            .eq('id', mapping.id);
        }
        toast.success('Sortie vers table désactivée');
      } else {
        if (!mapping.target_table) {
          toast.error('Veuillez sélectionner une table cible');
          setIsSaving(false);
          return;
        }

        if (mapping.field_mappings.length === 0 && mapping.static_mappings.length === 0) {
          toast.error('Ajoutez au moins un mapping de champ');
          setIsSaving(false);
          return;
        }

        const payload = {
          process_template_id: mapping.process_template_id,
          sub_process_template_id: mapping.sub_process_template_id,
          target_table: mapping.target_table,
          trigger_event: mapping.trigger_event,
          field_mappings: mapping.field_mappings.filter(fm => fm.custom_field_id && fm.target_column) as unknown as import('@/integrations/supabase/types').Json,
          static_mappings: mapping.static_mappings.filter(sm => sm.target_column && sm.static_value) as unknown as import('@/integrations/supabase/types').Json,
          is_active: true,
        };

        if (mapping.id) {
          const { error } = await supabase
            .from('process_table_output_mappings')
            .update(payload)
            .eq('id', mapping.id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from('process_table_output_mappings')
            .insert(payload)
            .select()
            .single();
          if (error) throw error;
          if (data) setMapping({ ...mapping, id: data.id });
        }

        toast.success('Sortie vers table enregistrée');
      }
    } catch (error) {
      console.error('Error saving output mapping:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Sortie vers table
            </CardTitle>
            <CardDescription>
              Génère automatiquement une ligne dans une table à la clôture d'une tâche
            </CardDescription>
          </div>
          {canManage && (
            <Switch
              checked={isEnabled}
              onCheckedChange={handleToggle}
            />
          )}
        </div>
      </CardHeader>

      {isEnabled && mapping && (
        <CardContent className="space-y-6">
          {/* Target table selection */}
          <div className="space-y-2">
            <Label>Table cible</Label>
            <SearchableSelect
              value={mapping.target_table}
              onValueChange={handleTableChange}
              placeholder="Sélectionner la table..."
              searchPlaceholder="Rechercher une table..."
              emptyMessage="Aucune table trouvée"
              options={publicTables.map(t => ({
                value: t.table_name,
                label: t.table_name,
              }))}
              disabled={!canManage}
            />
          </div>

          {mapping.target_table && targetColumns.length > 0 && (
            <>
              <Separator />

              {/* Field mappings */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Mapping des champs</Label>
                  {canManage && (
                    <Button variant="outline" size="sm" onClick={addFieldMapping}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Champ
                    </Button>
                  )}
                </div>

                {mapping.field_mappings.length === 0 && mapping.static_mappings.length === 0 && (
                  <p className="text-sm text-muted-foreground italic py-2">
                    Aucun mapping configuré. Ajoutez des champs ou des valeurs statiques.
                  </p>
                )}

                {mapping.field_mappings.map((fm, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 border rounded-lg bg-muted/30">
                    <div className="flex-1">
                      <SearchableSelect
                        value={fm.custom_field_id}
                        onValueChange={(v) => updateFieldMapping(index, { custom_field_id: v })}
                        placeholder="Champ source..."
                        searchPlaceholder="Rechercher..."
                        emptyMessage="Aucun champ"
                        options={customFields.map(f => ({
                          value: f.id,
                          label: f.label,
                        }))}
                        disabled={!canManage}
                        triggerClassName="h-8 text-xs"
                      />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1">
                      <SearchableSelect
                        value={fm.target_column}
                        onValueChange={(v) => updateFieldMapping(index, { target_column: v })}
                        placeholder="Colonne cible..."
                        searchPlaceholder="Rechercher..."
                        emptyMessage="Aucune colonne"
                        options={targetColumns.map(c => ({
                          value: c.column_name,
                          label: `${c.column_name} (${c.data_type})`,
                        }))}
                        disabled={!canManage}
                        triggerClassName="h-8 text-xs"
                      />
                    </div>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => removeFieldMapping(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <Separator />

              {/* Static mappings */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Valeurs statiques</Label>
                  {canManage && (
                    <Button variant="outline" size="sm" onClick={addStaticMapping}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Valeur
                    </Button>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Valeurs fixes insérées à chaque génération (ex: TIERS, FOU provisoires)
                </p>

                {mapping.static_mappings.map((sm, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 border rounded-lg bg-muted/30">
                    <div className="flex-1">
                      <SearchableSelect
                        value={sm.target_column}
                        onValueChange={(v) => updateStaticMapping(index, { target_column: v })}
                        placeholder="Colonne cible..."
                        searchPlaceholder="Rechercher..."
                        emptyMessage="Aucune colonne"
                        options={targetColumns.map(c => ({
                          value: c.column_name,
                          label: `${c.column_name} (${c.data_type})`,
                        }))}
                        disabled={!canManage}
                        triggerClassName="h-8 text-xs"
                      />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1">
                      <input
                        type="text"
                        className="w-full h-8 px-2 text-xs border rounded bg-background"
                        placeholder="Valeur statique..."
                        value={sm.static_value}
                        onChange={(e) => updateStaticMapping(index, { static_value: e.target.value })}
                        disabled={!canManage}
                      />
                    </div>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => removeStaticMapping(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* Summary */}
              {(mapping.field_mappings.length > 0 || mapping.static_mappings.length > 0) && (
                <>
                  <Separator />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Table2 className="h-3.5 w-3.5" />
                    <span>
                      {mapping.field_mappings.filter(fm => fm.custom_field_id && fm.target_column).length} champ(s) mappé(s)
                      {mapping.static_mappings.filter(sm => sm.target_column && sm.static_value).length > 0 &&
                        ` + ${mapping.static_mappings.filter(sm => sm.target_column && sm.static_value).length} valeur(s) statique(s)`
                      }
                      → <Badge variant="outline" className="text-xs">{mapping.target_table}</Badge>
                    </span>
                  </div>
                </>
              )}
            </>
          )}

          {canManage && (
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-2" />
              Enregistrer
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
