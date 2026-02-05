import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FormInput, ChevronDown, Database } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { TemplateCustomField } from '@/types/customField';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FieldInsertButtonProps {
  onInsert: (field: string) => void;
  customFields: TemplateCustomField[];
  disabled?: boolean;
  className?: string;
}

interface TableLookupConfig {
  id: string;
  table_name: string;
  display_column: string;
  label: string;
  description: string | null;
  is_active: boolean;
}

const SYSTEM_FIELDS = [
  { key: '{processus}', label: 'Nom du processus', description: 'Nom du processus en cours' },
  { key: '{sous_processus}', label: 'Sous-processus', description: 'Nom du sous-processus' },
  { key: '{tache}', label: 'Nom de la tâche', description: 'Titre de la tâche actuelle' },
  { key: '{demandeur}', label: 'Demandeur', description: 'Nom du demandeur' },
  { key: '{assignee}', label: 'Assigné', description: 'Nom de la personne assignée' },
  { key: '{date}', label: 'Date', description: 'Date du jour' },
  { key: '{echeance}', label: 'Échéance', description: 'Date d\'échéance' },
  { key: '{statut}', label: 'Statut', description: 'Statut actuel' },
  { key: '{priorite}', label: 'Priorité', description: 'Niveau de priorité' },
  { key: '{lien}', label: 'Lien', description: 'URL vers la demande' },
  { key: '{projet}', label: 'Projet', description: 'Nom du projet associé' },
  { key: '{code_site}', label: 'Code Site', description: 'Code du projet BE (code_projet)' },
];

export function FieldInsertButton({
  onInsert,
  customFields,
  disabled = false,
  className = '',
}: FieldInsertButtonProps) {
  const [tableLookupConfigs, setTableLookupConfigs] = useState<TableLookupConfig[]>([]);

  // Fetch table lookup configs
  useEffect(() => {
    async function fetchConfigs() {
      const { data } = await supabase
        .from('admin_table_lookup_configs')
        .select('id, table_name, display_column, label, description, is_active')
        .eq('is_active', true)
        .order('order_index');
      if (data) {
        setTableLookupConfigs(data);
      }
    }
    fetchConfigs();
  }, []);

  // Separate table_lookup fields from regular custom fields
  const { regularFields, tableLookupFields } = useMemo(() => {
    const regular: TemplateCustomField[] = [];
    const lookup: TemplateCustomField[] = [];
    
    customFields.forEach(field => {
      if (field.field_type === 'table_lookup') {
        lookup.push(field);
      } else {
        regular.push(field);
      }
    });
    
    return { regularFields: regular, tableLookupFields: lookup };
  }, [customFields]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`h-8 gap-1 ${className}`}
          disabled={disabled}
        >
          <FormInput className="h-4 w-4" />
          Champs
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b">
          <h4 className="font-medium text-sm">Insérer un champ personnalisé</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Cliquez pour insérer dans le champ
          </p>
        </div>
        
        <ScrollArea className="h-64">
          <div className="p-2">
            <Label className="text-xs font-medium text-muted-foreground mb-2 block">
              Champs système
            </Label>
            <div className="grid grid-cols-2 gap-1 mb-3">
              {SYSTEM_FIELDS.map((v) => (
                <Button
                  key={v.key}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto py-1 px-2 justify-start text-left"
                  onClick={() => onInsert(v.key)}
                >
                  <div className="flex flex-col items-start">
                    <span className="text-xs font-mono text-primary">{v.key}</span>
                    <span className="text-[10px] text-muted-foreground">{v.label}</span>
                  </div>
                </Button>
              ))}
            </div>

            {regularFields.length > 0 && (
              <>
                <Label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Champs personnalisés
                </Label>
                <div className="grid grid-cols-2 gap-1">
                  {regularFields.map((field) => (
                    <Button
                      key={field.id}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto py-1 px-2 justify-start text-left"
                      onClick={() => onInsert(`{champ:${field.name}}`)}
                    >
                      <div className="flex flex-col items-start">
                        <span className="text-xs font-mono text-blue-600">{`{champ:${field.name}}`}</span>
                        <span className="text-[10px] text-muted-foreground">{field.label}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </>
            )}

            {tableLookupFields.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 mt-3 mb-2">
                  <Database className="h-3.5 w-3.5 text-amber-600" />
                  <Label className="text-xs font-medium text-muted-foreground">
                    Champs listes (depuis table)
                  </Label>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {tableLookupFields.map((field) => (
                    <Button
                      key={field.id}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto py-1 px-2 justify-start text-left hover:bg-amber-50 dark:hover:bg-amber-900/20"
                      onClick={() => onInsert(`{champ:${field.name}}`)}
                    >
                      <div className="flex flex-col items-start">
                        <span className="text-xs font-mono text-amber-600 dark:text-amber-400">{`{champ:${field.name}}`}</span>
                        <span className="text-[10px] text-muted-foreground">{field.label}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </>
            )}

            {tableLookupConfigs.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 mt-3 mb-2">
                  <Database className="h-3.5 w-3.5 text-teal-600" />
                  <Label className="text-xs font-medium text-muted-foreground">
                    Tables de référence
                  </Label>
                  <Badge variant="outline" className="text-[9px] px-1.5 h-4 border-teal-300 text-teal-600">
                    Référence
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {tableLookupConfigs.map((config) => (
                    <Button
                      key={config.id}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto py-1 px-2 justify-start text-left hover:bg-teal-50 dark:hover:bg-teal-900/20"
                      onClick={() => onInsert(`{table:${config.table_name}.${config.display_column}}`)}
                    >
                      <div className="flex flex-col items-start">
                        <span className="text-xs font-mono text-teal-600 dark:text-teal-400">{`{${config.table_name}}`}</span>
                        <span className="text-[10px] text-muted-foreground">{config.label}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
