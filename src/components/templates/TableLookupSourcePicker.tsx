import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TableLookupConfig } from '@/hooks/useTableLookupConfigs';
import { useDatabaseTables, useTableColumns } from '@/hooks/useDatabaseTables';
import { Database, Settings2, Search } from 'lucide-react';

export interface TableLookupSourceValue {
  mode: 'config' | 'direct';
  configId?: string | null;
  tableName?: string | null;
  valueColumn?: string | null;
  labelColumn?: string | null;
  filterColumn?: string | null;
  filterValue?: string | null;
}

interface TableLookupSourcePickerProps {
  value: TableLookupSourceValue;
  onChange: (value: TableLookupSourceValue) => void;
  activeConfigs: TableLookupConfig[];
}

export function TableLookupSourcePicker({ value, onChange, activeConfigs }: TableLookupSourcePickerProps) {
  const { tables, isLoading: tablesLoading } = useDatabaseTables();
  const { columns, isLoading: columnsLoading } = useTableColumns(value.mode === 'direct' ? value.tableName || null : null);
  const [tableSearch, setTableSearch] = useState('');

  const filteredTables = tableSearch
    ? tables.filter(t => t.table_name.toLowerCase().includes(tableSearch.toLowerCase()))
    : tables;

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <Label className="text-base font-medium">Configuration de la table source</Label>

      <Tabs
        value={value.mode}
        onValueChange={(m) => onChange({ mode: m as 'config' | 'direct' })}
      >
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="config" className="flex items-center gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            Source configurée
          </TabsTrigger>
          <TabsTrigger value="direct" className="flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5" />
            Table directe
          </TabsTrigger>
        </TabsList>

        {/* Config mode - existing behavior */}
        <TabsContent value="config" className="space-y-3 mt-3">
          <div className="space-y-2">
            <Label>Source de données *</Label>
            <Select
              value={value.configId || '__none__'}
              onValueChange={(v) => onChange({ ...value, mode: 'config', configId: v === '__none__' ? null : v })}
            >
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

          {value.configId && (() => {
            const config = activeConfigs.find(c => c.id === value.configId);
            if (!config) return null;
            return (
              <div className="text-sm text-muted-foreground p-3 bg-background rounded border">
                <p><strong>Table :</strong> {config.table_name}</p>
                <p><strong>Affichage :</strong> {config.display_column}</p>
                <p><strong>Valeur :</strong> {config.value_column}</p>
                {config.filter_column && (
                  <p><strong>Filtre :</strong> {config.filter_column} = {config.filter_value}</p>
                )}
              </div>
            );
          })()}
        </TabsContent>

        {/* Direct mode - pick any table */}
        <TabsContent value="direct" className="space-y-3 mt-3">
          <div className="space-y-2">
            <Label>Table *</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une table..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="pl-9 mb-2"
              />
            </div>
            <Select
              value={value.tableName || '__none__'}
              onValueChange={(v) => {
                const tbl = v === '__none__' ? null : v;
                onChange({ ...value, mode: 'direct', tableName: tbl, valueColumn: null, labelColumn: null, filterColumn: null, filterValue: null });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={tablesLoading ? 'Chargement...' : 'Sélectionner une table'} />
              </SelectTrigger>
              <SelectContent className="bg-popover max-h-60">
                <SelectItem value="__none__">Sélectionner une table</SelectItem>
                {filteredTables.map((t) => (
                  <SelectItem key={t.table_name} value={t.table_name}>
                    {t.table_name} {t.row_count > 0 ? `(${t.row_count} lignes)` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {value.tableName && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Colonne valeur *</Label>
                  <Select
                    value={value.valueColumn || '__none__'}
                    onValueChange={(v) => onChange({ ...value, valueColumn: v === '__none__' ? null : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={columnsLoading ? '...' : 'Colonne'} />
                    </SelectTrigger>
                    <SelectContent className="bg-popover max-h-60">
                      <SelectItem value="__none__">Sélectionner</SelectItem>
                      {columns.map((c) => (
                        <SelectItem key={c.column_name} value={c.column_name}>
                          {c.column_name} <span className="text-muted-foreground text-xs">({c.data_type})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Colonne affichage *</Label>
                  <Select
                    value={value.labelColumn || '__none__'}
                    onValueChange={(v) => onChange({ ...value, labelColumn: v === '__none__' ? null : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={columnsLoading ? '...' : 'Colonne'} />
                    </SelectTrigger>
                    <SelectContent className="bg-popover max-h-60">
                      <SelectItem value="__none__">Sélectionner</SelectItem>
                      {columns.map((c) => (
                        <SelectItem key={c.column_name} value={c.column_name}>
                          {c.column_name} <span className="text-muted-foreground text-xs">({c.data_type})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Colonne filtre (optionnel)</Label>
                  <Select
                    value={value.filterColumn || '__none__'}
                    onValueChange={(v) => onChange({ ...value, filterColumn: v === '__none__' ? null : v, filterValue: v === '__none__' ? null : value.filterValue })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Aucun filtre" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover max-h-60">
                      <SelectItem value="__none__">Aucun filtre</SelectItem>
                      {columns.map((c) => (
                        <SelectItem key={c.column_name} value={c.column_name}>
                          {c.column_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {value.filterColumn && (
                  <div className="space-y-2">
                    <Label>Valeur du filtre</Label>
                    <Input
                      value={value.filterValue || ''}
                      onChange={(e) => onChange({ ...value, filterValue: e.target.value })}
                      placeholder="Valeur..."
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
