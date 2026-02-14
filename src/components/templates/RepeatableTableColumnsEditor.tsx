import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, GripVertical, Type, Hash, List, Database } from 'lucide-react';
import {
  FieldOption,
  RepeatableColumnType,
  REPEATABLE_COLUMN_TYPE_LABELS,
} from '@/types/customField';
import { useTableLookupConfigs } from '@/hooks/useTableLookupConfigs';

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

export function RepeatableTableColumnsEditor({
  columns,
  onChange,
}: RepeatableTableColumnsEditorProps) {
  const { activeConfigs } = useTableLookupConfigs();
  const [expandedColumn, setExpandedColumn] = useState<number | null>(null);

  const addColumn = () => {
    onChange([
      ...columns,
      { value: '', label: '', columnType: 'text' },
    ]);
    setExpandedColumn(columns.length);
  };

  const updateColumn = (index: number, updates: Partial<FieldOption>) => {
    const updated = [...columns];
    updated[index] = { ...updated[index], ...updates };

    // Auto-fill value from label
    if (updates.label && !updated[index].value) {
      updated[index].value = updates.label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
    }

    // When changing to table_lookup, clear select options and vice versa
    if (updates.columnType === 'table_lookup') {
      updated[index].selectOptions = undefined;
    } else if (updates.columnType === 'select') {
      updated[index].lookupConfigId = undefined;
      updated[index].lookupTable = undefined;
      updated[index].lookupValueColumn = undefined;
      updated[index].lookupLabelColumn = undefined;
      updated[index].lookupFilterColumn = undefined;
      updated[index].lookupFilterValue = undefined;
    } else if (updates.columnType === 'text' || updates.columnType === 'number') {
      updated[index].selectOptions = undefined;
      updated[index].lookupConfigId = undefined;
      updated[index].lookupTable = undefined;
      updated[index].lookupValueColumn = undefined;
      updated[index].lookupLabelColumn = undefined;
      updated[index].lookupFilterColumn = undefined;
      updated[index].lookupFilterValue = undefined;
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
      }
    }

    onChange(updated);
  };

  const removeColumn = (index: number) => {
    onChange(columns.filter((_, i) => i !== index));
    if (expandedColumn === index) setExpandedColumn(null);
    else if (expandedColumn !== null && expandedColumn > index) {
      setExpandedColumn(expandedColumn - 1);
    }
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

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-medium">Colonnes du tableau</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Définissez les colonnes et leur type de saisie
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addColumn}>
          <Plus className="h-4 w-4 mr-1" />
          Ajouter une colonne
        </Button>
      </div>

      {columns.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-lg">
          Aucune colonne définie. Ajoutez des colonnes pour configurer le tableau.
        </div>
      ) : (
        <div className="space-y-3">
          {columns.map((col, idx) => (
            <div
              key={idx}
              className="border rounded-lg bg-background overflow-hidden"
            >
              {/* Column header row */}
              <div className="flex items-center gap-2 p-3">
                <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <Input
                    placeholder="Libellé colonne"
                    value={col.label}
                    onChange={(e) => updateColumn(idx, { label: e.target.value })}
                    className="h-8 text-sm"
                  />
                  <Input
                    placeholder="Nom technique"
                    value={col.value}
                    onChange={(e) =>
                      updateColumn(idx, {
                        value: e.target.value.replace(/\s+/g, '_').toLowerCase(),
                      })
                    }
                    className="h-8 text-sm font-mono"
                  />
                  <Select
                    value={col.columnType || 'text'}
                    onValueChange={(v) =>
                      updateColumn(idx, { columnType: v as RepeatableColumnType })
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(REPEATABLE_COLUMN_TYPE_LABELS).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            <div className="flex items-center gap-2">
                              {COLUMN_TYPE_ICONS[value as RepeatableColumnType]}
                              {label}
                            </div>
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Badge variant="outline" className="text-[10px] flex-shrink-0">
                  {REPEATABLE_COLUMN_TYPE_LABELS[col.columnType || 'text']}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                  onClick={() => removeColumn(idx)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Type-specific configuration */}
              {col.columnType === 'table_lookup' && (
                <div className="px-3 pb-3 pt-0 border-t bg-muted/20">
                  <div className="pt-3 space-y-2">
                    <Label className="text-xs">Source de données</Label>
                    <Select
                      value={col.lookupConfigId || '__none__'}
                      onValueChange={(v) =>
                        updateColumn(idx, {
                          lookupConfigId: v === '__none__' ? undefined : v,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Sélectionner une source" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="__none__">Sélectionner...</SelectItem>
                        {activeConfigs.map((config) => (
                          <SelectItem key={config.id} value={config.id}>
                            {config.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {col.lookupConfigId && (
                      <div className="text-xs text-muted-foreground p-2 bg-background rounded border">
                        {(() => {
                          const config = activeConfigs.find(
                            (c) => c.id === col.lookupConfigId
                          );
                          if (!config) return null;
                          return (
                            <>
                              <span className="font-medium">{config.table_name}</span>
                              {' → '}
                              {config.display_column}
                              {config.filter_column && (
                                <span className="opacity-70">
                                  {' '}
                                  (filtre: {config.filter_column} = {config.filter_value})
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {col.columnType === 'select' && (
                <div className="px-3 pb-3 pt-0 border-t bg-muted/20">
                  <div className="pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Options de la liste</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => addSelectOption(idx)}
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
                            updateSelectOption(idx, optIdx, 'value', e.target.value)
                          }
                          className="h-7 text-xs"
                        />
                        <Input
                          placeholder="Libellé"
                          value={opt.label}
                          onChange={(e) =>
                            updateSelectOption(idx, optIdx, 'label', e.target.value)
                          }
                          className="h-7 text-xs"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeSelectOption(idx, optIdx)}
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
      )}
    </div>
  );
}
