import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Variable, ChevronDown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import type { TemplateCustomField } from '@/types/customField';

interface VariableInsertButtonProps {
  onInsert: (variable: string) => void;
  customFields: TemplateCustomField[];
  disabled?: boolean;
  className?: string;
}

const SYSTEM_VARIABLES = [
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
];

export function VariableInsertButton({
  onInsert,
  customFields,
  disabled = false,
  className = '',
}: VariableInsertButtonProps) {
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
          <Variable className="h-4 w-4" />
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
              {SYSTEM_VARIABLES.map((v) => (
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

            {customFields.length > 0 && (
              <>
                <Label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Champs personnalisés
                </Label>
                <div className="grid grid-cols-2 gap-1">
                  {customFields.map((field) => (
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
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
