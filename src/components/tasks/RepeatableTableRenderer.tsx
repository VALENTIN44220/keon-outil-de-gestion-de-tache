import { useState, useCallback, useEffect } from 'react';
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

// Cache for lookup data to avoid redundant fetches
const lookupCache: Record<string, { value: string; label: string }[]> = {};

async function fetchLookupOptions(col: FieldOption): Promise<{ value: string; label: string }[]> {
  const cacheKey = `${col.lookupTable}_${col.lookupLabelColumn}_${col.lookupValueColumn}_${col.lookupFilterColumn}_${col.lookupFilterValue}`;
  if (lookupCache[cacheKey]) return lookupCache[cacheKey];

  if (!col.lookupTable || !col.lookupLabelColumn || !col.lookupValueColumn) return [];

  let query = supabase
    .from(col.lookupTable as any)
    .select(`${col.lookupValueColumn}, ${col.lookupLabelColumn}`)
    .order(col.lookupLabelColumn);

  if (col.lookupFilterColumn && col.lookupFilterValue) {
    query = query.ilike(col.lookupFilterColumn, `%${col.lookupFilterValue}%`);
  }

  const { data } = await query.limit(500);
  const options = (data || []).map((row: any) => ({
    value: String(row[col.lookupValueColumn!]),
    label: String(row[col.lookupLabelColumn!]),
  }));

  lookupCache[cacheKey] = options;
  return options;
}

export function RepeatableTableRenderer({
  field,
  value,
  onChange,
  disabled,
}: RepeatableTableRendererProps) {
  const columns: FieldOption[] = (field.options as FieldOption[]) || [];
  const rows: RepeatableTableRow[] = value || [];
  const [lookupOptions, setLookupOptions] = useState<Record<string, { value: string; label: string }[]>>({});

  // Fetch lookup data for table_lookup columns
  useEffect(() => {
    const lookupCols = columns.filter(c => c.columnType === 'table_lookup' && c.lookupTable);
    if (lookupCols.length === 0) return;

    Promise.all(
      lookupCols.map(async (col) => {
        const options = await fetchLookupOptions(col);
        return { key: col.value, options };
      })
    ).then((results) => {
      const map: Record<string, { value: string; label: string }[]> = {};
      results.forEach(r => { map[r.key] = r.options; });
      setLookupOptions(map);
    });
  }, [columns]);

  const addRow = useCallback(() => {
    const newRow: RepeatableTableRow = {
      id: `row-${Date.now()}`,
      values: columns.reduce((acc, col) => {
        acc[col.value] = '';
        return acc;
      }, {} as Record<string, string>),
    };
    onChange(field.id, [...rows, newRow]);
  }, [columns, rows, onChange, field.id]);

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
    (rowId: string, colValue: string, cellValue: string) => {
      onChange(
        field.id,
        rows.map((r) =>
          r.id === rowId
            ? { ...r, values: { ...r.values, [colValue]: cellValue } }
            : r
        )
      );
    },
    [rows, onChange, field.id]
  );

  if (columns.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
        Aucune colonne configurée pour cette table.
      </div>
    );
  }

  const renderCell = (row: RepeatableTableRow, col: FieldOption) => {
    const cellValue = row.values[col.value] || '';
    const colType = col.columnType || 'text';

    switch (colType) {
      case 'number':
        return (
          <Input
            type="number"
            value={cellValue}
            onChange={(e) => updateCell(row.id, col.value, e.target.value)}
            className="h-8 text-sm"
            disabled={disabled}
            placeholder={col.label}
          />
        );

      case 'select':
        return (
          <Select
            value={cellValue || '__empty__'}
            onValueChange={(v) => updateCell(row.id, col.value, v === '__empty__' ? '' : v)}
            disabled={disabled}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder={col.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__empty__">—</SelectItem>
              {(col.selectOptions || []).map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'table_lookup': {
        const options = lookupOptions[col.value] || [];
        return (
          <SearchableSelect
            value={cellValue}
            onValueChange={(v) => updateCell(row.id, col.value, v)}
            placeholder={col.label}
            searchPlaceholder="Rechercher..."
            triggerClassName="h-8 text-sm"
            options={[
              { value: '__empty__', label: '—' },
              ...options,
            ]}
          />
        );
      }

      default: // text
        return (
          <Input
            value={cellValue}
            onChange={(e) => updateCell(row.id, col.value, e.target.value)}
            className="h-8 text-sm"
            disabled={disabled}
            placeholder={col.label}
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
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.value} className="text-xs font-medium">
                    {col.label}
                  </TableHead>
                ))}
                {!disabled && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  {columns.map((col) => (
                    <TableCell key={col.value} className="p-1.5">
                      {renderCell(row, col)}
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
