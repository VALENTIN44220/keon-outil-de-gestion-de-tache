import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, GripVertical, Type, Hash, List, Database, Columns3, Info } from 'lucide-react';
import {
  FieldOption,
  RepeatableColumnType,
  REPEATABLE_COLUMN_TYPE_LABELS,
} from '@/types/customField';
import { useTableLookupConfigs } from '@/hooks/useTableLookupConfigs';
import { supabase } from '@/integrations/supabase/client';

interface RepeatableTableColumnsEditorProps {
  columns: FieldOption[];
  onChange: (columns: FieldOption[]) => void;
}

const COLUMN_TYPE_ICONS: Record<RepeatableColumnType, React.ReactNode> = {
  text: <Type className="h-3.5 w-3.5" />,
  number: <Hash className="h-3.5 w-3.5" />,
  select: <List className="h-3.5 w-3.5" />,
  table_lookup: <Database className="h-3.5 w-3.5" />,
};

// System columns to exclude from display
const SYSTEM_COLUMNS = ['id', 'created_at', 'updated_at'];

export function RepeatableTableColumnsEditor({
  columns,
  onChange,
}: RepeatableTableColumnsEditorProps) {
  const { activeConfigs } = useTableLookupConfigs();
  const [tableColumns, setTableColumns] = useState<Record<string, string[]>>({});

  // Fetch available columns for known tables
  useEffect(() => {
    const tablesToFetch = activeConfigs
      .map(c => c.table_name)
      .filter((v, i, a) => a.indexOf(v) === i);

    tablesToFetch.forEach(async (tableName) => {
      if (tableColumns[tableName]) return;
      try {
        // Fetch one row to discover columns
        const { data } = await supabase
          .from(tableName as any)
          .select('*')
          .limit(1);
        if (data && data.length > 0) {
          const cols = Object.keys(data[0]).filter(c => !SYSTEM_COLUMNS.includes(c));
          setTableColumns(prev => ({ ...prev, [tableName]: cols }));
        }
      } catch {
        // ignore
      }
    });
  }, [activeConfigs]);

  const addFreeColumn = () => {
    onChange([
      ...columns,
      { value: '', label: '', columnType: 'text' },
    ]);
  };

  const addTableLookupColumn = () => {
    onChange([
      ...columns,
      { value: '', label: '', columnType: 'table_lookup', lookupDisplayColumns: [] },
    ]);
  };

  const updateColumn = (index: number, updates: Partial<FieldOption>) => {
    const updated = [...columns];
    updated[index] = { ...updated[index], ...updates };

    // Auto-fill value from label for free columns
    if (updates.label && !updated[index].value) {
      updated[index].value = updates.label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
    }

    // When selecting a lookup config, populate lookup fields
    if (updates.lookupConfigId) {
      const config = activeConfigs.find(c => c.id === updates.lookupConfigId);
      if (config) {
        updated[index].lookupTable = config.table_name;
        updated[index].lookupValueColumn = config.value_column;
        updated[index].lookupLabelColumn = config.display_column;
        updated[index].lookupFilterColumn = config.filter_column || undefined;
        updated[index].lookupFilterValue = config.filter_value || undefined;
        // Auto-set label/value if empty
        if (!updated[index].label) {
          updated[index].label = config.label;
          updated[index].value = config.table_name;
        }
      }
    }

    onChange(updated);
  };

  const removeColumn = (index: number) => {
    onChange(columns.filter((_, i) => i !== index));
  };

  const toggleDisplayColumn = (colIndex: number, dbColumn: string) => {
    const col = columns[colIndex];
    const current = col.lookupDisplayColumns || [];
    const updated = current.includes(dbColumn)
      ? current.filter(c => c !== dbColumn)
      : [...current, dbColumn];
    updateColumn(colIndex, { lookupDisplayColumns: updated });
  };

  const addSelectOption = (colIndex: number) => {
    const col = columns[colIndex];
    const opts = col.selectOptions || [];
    updateColumn(colIndex, {
      selectOptions: [...opts, { value: '', label: '' }],
    });
  };

  const updateSelectOption = (
    colIndex: number,
    optIndex: number,
    field: 'value' | 'label',
    val: string
  ) => {
    const col = columns[colIndex];
    const opts = [...(col.selectOptions || [])];
    opts[optIndex] = { ...opts[optIndex], [field]: val };
    updateColumn(colIndex, { selectOptions: opts });
  };

  const removeSelectOption = (colIndex: number, optIndex: number) => {
    const col = columns[colIndex];
    const opts = (col.selectOptions || []).filter((_, i) => i !== optIndex);
    updateColumn(colIndex, { selectOptions: opts });
  };

  // Separate columns by type
  const lookupColumns = columns
    .map((c, i) => ({ col: c, index: i }))
    .filter(x => x.col.columnType === 'table_lookup');
  const freeColumns = columns
    .map((c, i) => ({ col: c, index: i }))
    .filter(x => x.col.columnType !== 'table_lookup');

  return (
    <div className="space-y-6 p-4 border rounded-lg bg-muted/30">
      <div>
        <Label className="text-base font-medium">Configuration du tableau multi-lignes</Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          Combinez des colonnes issues d'une table de référence et des champs libres
        </p>
      </div>

      {/* Section 1: Table source columns */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <Label className="text-sm font-medium">Colonnes depuis une table</Label>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addTableLookupColumn}>
            <Plus className="h-4 w-4 mr-1" />
            Source de données
          </Button>
        </div>

        {lookupColumns.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-3 border border-dashed rounded-lg">
            Aucune source de données. L'utilisateur saisira uniquement des champs libres.
          </div>
        )}

        {lookupColumns.map(({ col, index }) => (
          <div key={index} className="border rounded-lg bg-background overflow-hidden">
            <div className="flex items-center gap-2 p-3">
              <Database className="h-4 w-4 text-primary flex-shrink-0" />
              <div className="flex-1 grid grid-cols-2 gap-2">
                <Input
                  placeholder="Libellé (ex: Article)"
                  value={col.label}
                  onChange={(e) => updateColumn(index, { label: e.target.value })}
                  className="h-8 text-sm"
                />
                <Select
                  value={col.lookupConfigId || '__none__'}
                  onValueChange={(v) =>
                    updateColumn(index, {
                      lookupConfigId: v === '__none__' ? undefined : v,
                    })
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Source de données" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="__none__">Sélectionner une source...</SelectItem>
                    {activeConfigs.map((config) => (
                      <SelectItem key={config.id} value={config.id}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                onClick={() => removeColumn(index)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Display columns picker */}
            {col.lookupTable && tableColumns[col.lookupTable] && (
              <div className="px-3 pb-3 border-t bg-muted/20">
                <div className="pt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Columns3 className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs font-medium">Colonnes à afficher</Label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tableColumns[col.lookupTable].map((dbCol) => {
                      const isSelected = (col.lookupDisplayColumns || []).includes(dbCol);
                      const isSearchColumn = dbCol === col.lookupLabelColumn;
                      return (
                        <div
                          key={dbCol}
                          className="flex items-center gap-1.5"
                        >
                          <Checkbox
                            id={`col-${index}-${dbCol}`}
                            checked={isSelected || isSearchColumn}
                            disabled={isSearchColumn}
                            onCheckedChange={() => toggleDisplayColumn(index, dbCol)}
                          />
                          <label
                            htmlFor={`col-${index}-${dbCol}`}
                            className="text-xs cursor-pointer select-none"
                          >
                            {dbCol}
                            {isSearchColumn && (
                              <span className="text-primary ml-1">(recherche)</span>
                            )}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                  {(col.lookupDisplayColumns || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {[col.lookupLabelColumn, ...(col.lookupDisplayColumns || [])]
                        .filter((v, i, a) => v && a.indexOf(v) === i)
                        .map(dc => (
                          <Badge key={dc} variant="secondary" className="text-[10px]">
                            {dc}
                          </Badge>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {col.lookupConfigId && col.lookupTable && !tableColumns[col.lookupTable] && (
              <div className="px-3 pb-3 border-t bg-muted/20">
                <p className="text-xs text-muted-foreground pt-3">Chargement des colonnes...</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Section 2: Free columns */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-accent-foreground" />
            <Label className="text-sm font-medium">Champs libres</Label>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addFreeColumn}>
            <Plus className="h-4 w-4 mr-1" />
            Champ libre
          </Button>
        </div>

        {freeColumns.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-3 border border-dashed rounded-lg">
            Aucun champ libre. Ajoutez par exemple un champ "Quantité" de type nombre.
          </div>
        )}

        {freeColumns.map(({ col, index }) => (
          <div key={index} className="border rounded-lg bg-background overflow-hidden">
            <div className="flex items-center gap-2 p-3">
              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 grid grid-cols-3 gap-2">
                <Input
                  placeholder="Libellé (ex: Quantité)"
                  value={col.label}
                  onChange={(e) => updateColumn(index, { label: e.target.value })}
                  className="h-8 text-sm"
                />
                <Input
                  placeholder="Nom technique"
                  value={col.value}
                  onChange={(e) =>
                    updateColumn(index, {
                      value: e.target.value.replace(/\s+/g, '_').toLowerCase(),
                    })
                  }
                  className="h-8 text-sm font-mono"
                />
                <Select
                  value={col.columnType || 'text'}
                  onValueChange={(v) =>
                    updateColumn(index, { columnType: v as RepeatableColumnType })
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">
                      <div className="flex items-center gap-2">
                        <Type className="h-3.5 w-3.5" /> Texte libre
                      </div>
                    </SelectItem>
                    <SelectItem value="number">
                      <div className="flex items-center gap-2">
                        <Hash className="h-3.5 w-3.5" /> Nombre
                      </div>
                    </SelectItem>
                    <SelectItem value="select">
                      <div className="flex items-center gap-2">
                        <List className="h-3.5 w-3.5" /> Liste déroulante
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                onClick={() => removeColumn(index)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Select options config */}
            {col.columnType === 'select' && (
              <div className="px-3 pb-3 border-t bg-muted/20">
                <div className="pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Options de la liste</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => addSelectOption(index)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Option
                    </Button>
                  </div>
                  {(col.selectOptions || []).map((opt, optIdx) => (
                    <div key={optIdx} className="flex gap-2">
                      <Input
                        placeholder="Valeur"
                        value={opt.value}
                        onChange={(e) =>
                          updateSelectOption(index, optIdx, 'value', e.target.value)
                        }
                        className="h-7 text-xs"
                      />
                      <Input
                        placeholder="Libellé"
                        value={opt.label}
                        onChange={(e) =>
                          updateSelectOption(index, optIdx, 'label', e.target.value)
                        }
                        className="h-7 text-xs"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeSelectOption(index, optIdx)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  {(!col.selectOptions || col.selectOptions.length === 0) && (
                    <p className="text-xs text-muted-foreground">Aucune option</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Preview summary */}
      {columns.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Aperçu du tableau</p>
            <p>
              Colonnes : {columns.map(c => c.label || '(sans nom)').join(' | ')}
              {lookupColumns.some(lc => (lc.col.lookupDisplayColumns || []).length > 0) && (
                <span className="block mt-1">
                  + colonnes auto-remplies depuis la table source
                </span>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
