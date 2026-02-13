import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Columns3 } from 'lucide-react';

export interface ColumnDefinition {
  key: string;
  label: string;
  defaultVisible?: boolean;
}

export const ALL_PROJECT_COLUMNS: ColumnDefinition[] = [
  { key: 'code_projet', label: 'Code', defaultVisible: true },
  { key: 'nom_projet', label: 'Nom du projet', defaultVisible: true },
  { key: 'status', label: 'Statut', defaultVisible: true },
  { key: 'typologie', label: 'Typologie', defaultVisible: true },
  { key: 'pays', label: 'Pays', defaultVisible: true },
  { key: 'pays_site', label: 'Pays site', defaultVisible: false },
  { key: 'region', label: 'Région', defaultVisible: false },
  { key: 'departement', label: 'Département', defaultVisible: false },
  { key: 'code_divalto', label: 'Code Divalto', defaultVisible: false },
  { key: 'siret', label: 'SIRET', defaultVisible: false },
  { key: 'date_cloture_bancaire', label: 'Clôture bancaire', defaultVisible: false },
  { key: 'date_cloture_juridique', label: 'Clôture juridique', defaultVisible: false },
  { key: 'date_os_etude', label: 'OS Étude', defaultVisible: false },
  { key: 'date_os_travaux', label: 'OS Travaux', defaultVisible: false },
  { key: 'actionnariat', label: 'Actionnariat', defaultVisible: false },
  { key: 'regime_icpe', label: 'Régime ICPE', defaultVisible: false },
  { key: 'adresse_site', label: 'Adresse site', defaultVisible: false },
  { key: 'adresse_societe', label: 'Adresse société', defaultVisible: false },
  { key: 'description', label: 'Description', defaultVisible: false },
  { key: 'gps_coordinates', label: 'Coordonnées GPS', defaultVisible: false },
  { key: 'created_at', label: 'Créé le', defaultVisible: true },
];

interface ProjectColumnSelectorProps {
  visibleColumns: string[];
  onColumnsChange: (columns: string[]) => void;
}

export function ProjectColumnSelector({ visibleColumns, onColumnsChange }: ProjectColumnSelectorProps) {
  const [open, setOpen] = useState(false);

  const handleToggleColumn = (columnKey: string) => {
    if (visibleColumns.includes(columnKey)) {
      onColumnsChange(visibleColumns.filter(c => c !== columnKey));
    } else {
      onColumnsChange([...visibleColumns, columnKey]);
    }
  };

  const handleSelectAll = () => {
    onColumnsChange(ALL_PROJECT_COLUMNS.map(c => c.key));
  };

  const handleDeselectAll = () => {
    onColumnsChange(['code_projet', 'nom_projet']); // Garder au minimum le code et le nom
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Columns3 className="h-4 w-4" />
          Colonnes ({visibleColumns.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Colonnes visibles</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleSelectAll}>
                Tout
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleDeselectAll}>
                Min
              </Button>
            </div>
          </div>
        </div>
        <ScrollArea className="h-[300px]">
          <div className="p-3 space-y-2">
            {ALL_PROJECT_COLUMNS.map(column => (
              <div key={column.key} className="flex items-center gap-2">
                <Checkbox
                  id={`col-${column.key}`}
                  checked={visibleColumns.includes(column.key)}
                  onCheckedChange={() => handleToggleColumn(column.key)}
                  disabled={['code_projet', 'nom_projet'].includes(column.key)}
                />
                <Label 
                  htmlFor={`col-${column.key}`} 
                  className="text-sm cursor-pointer flex-1"
                >
                  {column.label}
                </Label>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export function getDefaultVisibleColumns(): string[] {
  return ALL_PROJECT_COLUMNS.filter(c => c.defaultVisible).map(c => c.key);
}
