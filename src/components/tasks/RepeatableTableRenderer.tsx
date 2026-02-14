import { useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Plus, Trash2, Table2 } from 'lucide-react';
import { TemplateCustomField, FieldOption } from '@/types/customField';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { supabase } from '@/integrations/supabase/client';

interface RepeatableTableRow {
  id: string;
  values: Record<string, string>;
}

interface RepeatableTableRendererProps {
  field: TemplateCustomField;
  value: RepeatableTableRow[] | null;
  onChange: (fieldId: string, value: RepeatableTableRow[]) => void;
  disabled?: boolean;
}

// Cache for lookup data
const lookupCache: Record<string, Record<string, any>[]> = {};

async function fetchLookupRows(col: FieldOption): Promise<Record<string, any>[]> {
  if (!col.lookupTable) return [];

  // Build select columns: value + label + display columns
  const selectCols = new Set<string>();
  if (col.lookupValueColumn) selectCols.add(col.lookupValueColumn);
  if (col.lookupLabelColumn) selectCols.add(col.lookupLabelColumn);
  (col.lookupDisplayColumns || []).forEach(c => selectCols.add(c));

  const cacheKey = `${col.lookupTable}_${[...selectCols].sort().join(',')}_${col.lookupFilterColumn}_${col.lookupFilterValue}`;
  if (lookupCache[cacheKey]) return lookupCache[cacheKey];

  let query = supabase
    .from(col.lookupTable as any)
    .select([...selectCols].join(', '))
    .order(col.lookupLabelColumn || [...selectCols][0]);

  if (col.lookupFilterColumn && col.lookupFilterValue) {
    query = query.ilike(col.lookupFilterColumn, `%${col.lookupFilterValue}%`);
  }

  const { data } = await query.limit(500);
  const rows = (data || []) as Record<string, any>[];
  lookupCache[cacheKey] = rows;
  return rows;
}

export function RepeatableTableRenderer({
  field,
  value,
  onChange,
  disabled,
}: RepeatableTableRendererProps) {
  const configColumns: FieldOption[] = (field.options as FieldOption[]) || [];
  const rows: RepeatableTableRow[] = value || [];
  const [lookupData, setLookupData] = useState<Record<string, Record<string, any>[]>>({});

  // Fetch lookup data for table_lookup columns
  useEffect(() => {
    const lookupCols = configColumns.filter(c => c.columnType === 'table_lookup' && c.lookupTable);
    if (lookupCols.length === 0) return;

    Promise.all(
      lookupCols.map(async (col) => {
        const data = await fetchLookupRows(col);
        return { key: col.value, data };
      })
    ).then((results) => {
      const map: Record<string, Record<string, any>[]> = {};
      results.forEach(r => { map[r.key] = r.data; });
      setLookupData(map);
    });
  }, [configColumns]);

  // Build the effective display columns: lookup columns expand into multiple table columns
  const displayColumns = useMemo(() => {
    const result: {
      key: string;
      label: string;
      sourceCol: FieldOption;
      type: 'input' | 'lookup_search' | 'lookup_display';
      dbColumn?: string;
    }[] = [];

    configColumns.forEach(col => {
      if (col.columnType === 'table_lookup') {
        // The search/select column
        result.push({
          key: col.value,
          label: col.lookupLabelColumn || col.label,
          sourceCol: col,
          type: 'lookup_search',
        });
        // Additional display columns from the source table
        (col.lookupDisplayColumns || []).forEach(dc => {
          if (dc !== col.lookupLabelColumn) {
            result.push({
              key: `${col.value}__${dc}`,
              label: dc,
              sourceCol: col,
              type: 'lookup_display',
              dbColumn: dc,
            });
          }
        });
      } else {
        result.push({
          key: col.value,
          label: col.label,
          sourceCol: col,
          type: 'input',
        });
      }
    });

    return result;
  }, [configColumns]);

  const addRow = useCallback(() => {
    const newRow: RepeatableTableRow = {
      id: `row-${Date.now()}`,
      values: {},
    };
    onChange(field.id, [...rows, newRow]);
  }, [rows, onChange, field.id]);

  const removeRow = useCallback(
    (rowId: string) => {
      onChange(
        field.id,
        rows.filter((r) => r.id !== rowId)
      );
    },
    [rows, onChange, field.id]
  );

  const updateCell = useCallback(
    (rowId: string, colKey: string, cellValue: string) => {
      onChange(
        field.id,
        rows.map((r) =>
          r.id === rowId
            ? { ...r, values: { ...r.values, [colKey]: cellValue } }
            : r
        )
      );
    },
    [rows, onChange, field.id]
  );

  // When a lookup value is selected, auto-fill display columns
  const handleLookupSelect = useCallback(
    (rowId: string, col: FieldOption, selectedValue: string) => {
      const data = lookupData[col.value] || [];
      const selectedRow = data.find(
        r => String(r[col.lookupLabelColumn || '']) === selectedValue
      );

      const updates: Record<string, string> = {
        [col.value]: selectedValue,
      };

      if (selectedRow) {
        (col.lookupDisplayColumns || []).forEach(dc => {
          if (dc !== col.lookupLabelColumn) {
            updates[`${col.value}__${dc}`] = String(selectedRow[dc] ?? '');
          }
        });
      }

      onChange(
        field.id,
        rows.map((r) =>
          r.id === rowId
            ? { ...r, values: { ...r.values, ...updates } }
            : r
        )
      );
    },
    [rows, onChange, field.id, lookupData]
  );

  if (configColumns.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
        Aucune colonne configurée pour cette table.
      </div>
    );
  }

  const renderCell = (row: RepeatableTableRow, dc: typeof displayColumns[0]) => {
    const cellValue = row.values[dc.key] || '';

    if (dc.type === 'lookup_display') {
      // Read-only auto-filled column
      return (
        <span className="text-sm text-muted-foreground px-2 py-1 block bg-muted/30 rounded min-h-[32px] flex items-center">
          {cellValue || '—'}
        </span>
      );
    }

    if (dc.type === 'lookup_search') {
      const col = dc.sourceCol;
      const data = lookupData[col.value] || [];
      const options = data.map(r => ({
        value: String(r[col.lookupLabelColumn || '']),
        label: String(r[col.lookupLabelColumn || '']),
      }));

      return (
        <SearchableSelect
          value={cellValue}
          onValueChange={(v) => handleLookupSelect(row.id, col, v)}
          placeholder={dc.label}
          searchPlaceholder="Rechercher..."
          triggerClassName="h-8 text-sm"
          options={options}
        />
      );
    }

    // Free input columns
    const colType = dc.sourceCol.columnType || 'text';

    switch (colType) {
      case 'number':
        return (
          <Input
            type="number"
            value={cellValue}
            onChange={(e) => updateCell(row.id, dc.key, e.target.value)}
            className="h-8 text-sm"
            disabled={disabled}
            placeholder={dc.label}
          />
        );

      case 'select':
        return (
          <Select
            value={cellValue || '__empty__'}
            onValueChange={(v) => updateCell(row.id, dc.key, v === '__empty__' ? '' : v)}
            disabled={disabled}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder={dc.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__empty__">—</SelectItem>
              {(dc.sourceCol.selectOptions || []).map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      default:
        return (
          <Input
            value={cellValue}
            onChange={(e) => updateCell(row.id, dc.key, e.target.value)}
            className="h-8 text-sm"
            disabled={disabled}
            placeholder={dc.label}
          />
        );
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Table2 className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">
          {field.label} ({rows.length} ligne{rows.length > 1 ? 's' : ''})
        </Label>
        {field.is_required && <span className="text-destructive text-xs">*</span>}
      </div>

      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}

      {rows.length > 0 && (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {displayColumns.map((dc) => (
                  <TableHead key={dc.key} className="text-xs font-medium whitespace-nowrap">
                    {dc.label}
                    {dc.type === 'lookup_display' && (
                      <span className="text-muted-foreground ml-1">(auto)</span>
                    )}
                  </TableHead>
                ))}
                {!disabled && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  {displayColumns.map((dc) => (
                    <TableCell key={dc.key} className="p-1.5">
                      {renderCell(row, dc)}
                    </TableCell>
                  ))}
                  {!disabled && (
                    <TableCell className="p-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeRow(row.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {rows.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
          Aucune ligne ajoutée. Cliquez sur "Ajouter une ligne" pour commencer.
        </div>
      )}

      {!disabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={addRow}
        >
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une ligne
        </Button>
      )}
    </div>
  );
}
