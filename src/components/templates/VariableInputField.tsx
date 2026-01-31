import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Variable, ChevronDown } from 'lucide-react';
import type { TemplateCustomField } from '@/types/customField';

const SYSTEM_VARIABLES = [
  { key: '{processus}', label: 'Nom du processus', description: 'Nom du processus en cours' },
  { key: '{sous_processus}', label: 'Sous-processus', description: 'Nom du sous-processus' },
  { key: '{demandeur}', label: 'Demandeur', description: 'Nom du demandeur' },
  { key: '{assignee}', label: 'Assigné', description: 'Nom de la personne assignée' },
  { key: '{date}', label: 'Date', description: 'Date du jour' },
  { key: '{echeance}', label: 'Échéance', description: 'Date d\'échéance' },
  { key: '{priorite}', label: 'Priorité', description: 'Niveau de priorité' },
  { key: '{projet}', label: 'Projet', description: 'Nom du projet associé' },
];

interface VariableInputFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  customFields: TemplateCustomField[];
  type?: 'input' | 'textarea';
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  rows?: number;
}

export function VariableInputField({
  id,
  label,
  value,
  onChange,
  customFields,
  type = 'input',
  placeholder,
  required,
  maxLength,
  rows = 3,
}: VariableInputFieldProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = useState<number>(0);

  const handleInsertVariable = (variable: string) => {
    const input = inputRef.current;
    if (!input) {
      // Just append if no input ref
      onChange(value + variable);
      return;
    }

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const newValue = value.substring(0, start) + variable + value.substring(end);
    onChange(newValue);

    // Set cursor position after the inserted variable
    setTimeout(() => {
      const newPosition = start + variable.length;
      input.setSelectionRange(newPosition, newPosition);
      input.focus();
    }, 0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  // Track cursor position
  const handleSelect = (e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    setCursorPosition(target.selectionStart || 0);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>
          {label} {required && '*'}
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
            >
              <Variable className="h-3 w-3 mr-1" />
              Insérer variable
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="p-3 border-b">
              <h4 className="font-medium text-sm">Insérer une variable</h4>
              <p className="text-xs text-muted-foreground mt-1">
                La variable sera remplacée par sa valeur lors de la création de tâches
              </p>
            </div>
            
            <ScrollArea className="h-64">
              <div className="p-2">
                <Label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Variables système
                </Label>
                <div className="grid grid-cols-2 gap-1 mb-3">
                  {SYSTEM_VARIABLES.map((v) => (
                    <Button
                      key={v.key}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto py-1 px-2 justify-start text-left"
                      onClick={() => handleInsertVariable(v.key)}
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
                          onClick={() => handleInsertVariable(`{champ:${field.name}}`)}
                        >
                          <div className="flex flex-col items-start">
                            <span className="text-xs font-mono text-blue-600 dark:text-blue-400">{`{${field.name}}`}</span>
                            <span className="text-[10px] text-muted-foreground">{field.label}</span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </>
                )}

                {customFields.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    Aucun champ personnalisé disponible
                  </p>
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>

      {type === 'input' ? (
        <Input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          id={id}
          value={value}
          onChange={handleInputChange}
          onSelect={handleSelect}
          placeholder={placeholder}
          required={required}
          maxLength={maxLength}
        />
      ) : (
        <Textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          id={id}
          value={value}
          onChange={handleInputChange}
          onSelect={handleSelect}
          placeholder={placeholder}
          required={required}
          maxLength={maxLength}
          rows={rows}
        />
      )}

      {/* Preview of detected variables */}
      {value && (value.includes('{') && value.includes('}')) && (
        <p className="text-xs text-muted-foreground">
          Variables détectées : les valeurs seront remplacées lors de la création
        </p>
      )}
    </div>
  );
}
