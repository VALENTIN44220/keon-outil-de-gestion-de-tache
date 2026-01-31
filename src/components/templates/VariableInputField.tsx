import { useState, useRef, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Variable, ChevronDown, Globe, Layers, GitBranch } from 'lucide-react';
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
  const [isOpen, setIsOpen] = useState(false);

  // Group custom fields by scope
  const groupedFields = useMemo(() => {
    const common: TemplateCustomField[] = [];
    const process: TemplateCustomField[] = [];
    const subProcess: TemplateCustomField[] = [];

    customFields.forEach(field => {
      if (field.is_common) {
        common.push(field);
      } else if (field.sub_process_template_id) {
        subProcess.push(field);
      } else if (field.process_template_id) {
        process.push(field);
      }
    });

    return { common, process, subProcess };
  }, [customFields]);

  const handleInsertVariable = (variable: string) => {
    const input = inputRef.current;
    if (!input) {
      // Just append if no input ref
      onChange(value + variable);
      setIsOpen(false);
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
    
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const hasCustomFields = customFields.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>
          {label} {required && '*'}
        </Label>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
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
          <PopoverContent className="w-96 p-0" align="end">
            <div className="p-3 border-b bg-muted/30">
              <h4 className="font-medium text-sm">Insérer une variable</h4>
              <p className="text-xs text-muted-foreground mt-1">
                La variable sera remplacée par sa valeur lors de la création de tâches
              </p>
            </div>
            
            <ScrollArea className="h-80">
              <div className="p-3 space-y-4">
                {/* System variables */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Globe className="h-3.5 w-3.5 text-primary" />
                    <Label className="text-xs font-medium">Variables système</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {SYSTEM_VARIABLES.map((v) => (
                      <Button
                        key={v.key}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto py-1.5 px-2 justify-start text-left hover:bg-primary/10"
                        onClick={() => handleInsertVariable(v.key)}
                      >
                        <div className="flex flex-col items-start">
                          <span className="text-xs font-mono text-primary">{v.key}</span>
                          <span className="text-[10px] text-muted-foreground">{v.label}</span>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Common custom fields */}
                {groupedFields.common.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Layers className="h-3.5 w-3.5 text-emerald-600" />
                      <Label className="text-xs font-medium">Champs communs</Label>
                      <Badge variant="secondary" className="text-[9px] px-1.5 h-4">
                        Partagés
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {groupedFields.common.map((field) => (
                        <Button
                          key={field.id}
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto py-1.5 px-2 justify-start text-left hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                          onClick={() => handleInsertVariable(`{champ:${field.name}}`)}
                        >
                          <div className="flex flex-col items-start">
                            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">{`{${field.name}}`}</span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{field.label}</span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Process-level custom fields */}
                {groupedFields.process.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Layers className="h-3.5 w-3.5 text-blue-600" />
                      <Label className="text-xs font-medium">Champs du processus</Label>
                      <Badge variant="outline" className="text-[9px] px-1.5 h-4 border-blue-300 text-blue-600">
                        Processus
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {groupedFields.process.map((field) => (
                        <Button
                          key={field.id}
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto py-1.5 px-2 justify-start text-left hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          onClick={() => handleInsertVariable(`{champ:${field.name}}`)}
                        >
                          <div className="flex flex-col items-start">
                            <span className="text-xs font-mono text-blue-600 dark:text-blue-400">{`{${field.name}}`}</span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{field.label}</span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub-process-level custom fields */}
                {groupedFields.subProcess.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <GitBranch className="h-3.5 w-3.5 text-violet-600" />
                      <Label className="text-xs font-medium">Champs du sous-processus</Label>
                      <Badge variant="outline" className="text-[9px] px-1.5 h-4 border-violet-300 text-violet-600">
                        Spécifique
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {groupedFields.subProcess.map((field) => (
                        <Button
                          key={field.id}
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto py-1.5 px-2 justify-start text-left hover:bg-violet-50 dark:hover:bg-violet-900/20"
                          onClick={() => handleInsertVariable(`{champ:${field.name}}`)}
                        >
                          <div className="flex flex-col items-start">
                            <span className="text-xs font-mono text-violet-600 dark:text-violet-400">{`{${field.name}}`}</span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{field.label}</span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {!hasCustomFields && (
                  <p className="text-xs text-muted-foreground italic text-center py-2">
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
