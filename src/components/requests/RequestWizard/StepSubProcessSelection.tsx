import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, GitBranch, User, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { SubProcessSelection } from './types';

interface StepSubProcessSelectionProps {
  processId: string | null;
  processName: string | null;
  selectedSubProcesses: string[];
  onSelectionChange: (selected: string[], available: SubProcessSelection[]) => void;
}

const DEBUG_REACT_185 =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  window.localStorage?.getItem('debug-react185') === '1';

const sameStringSet = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  for (const x of b) if (!setA.has(x)) return false;
  return true;
};

export function StepSubProcessSelection({
  processId,
  processName,
  selectedSubProcesses,
  onSelectionChange,
}: StepSubProcessSelectionProps) {
  const [subProcesses, setSubProcesses] = useState<SubProcessSelection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSubProcesses = async () => {
      if (!processId) return;

      setIsLoading(true);
      try {
        const { data } = await supabase
          .from('sub_process_templates')
          .select(
            `
            id,
            name,
            description,
            assignment_type,
            target_manager_id,
            target_department_id,
            is_mandatory
          `
          )
          .eq('process_template_id', processId)
          .order('order_index');

        if (data) {
          const subProcessData: SubProcessSelection[] = data.map((sp: any) => ({
            id: sp.id,
            name: sp.name,
            description: sp.description,
            isSelected: sp.is_mandatory || selectedSubProcesses.includes(sp.id),
            isMandatory: sp.is_mandatory,
            assignment_type: sp.assignment_type,
            target_manager_id: sp.target_manager_id,
            target_department_id: sp.target_department_id,
          }));

          setSubProcesses(subProcessData);

          // Auto-select mandatory ones (idempotent)
          const mandatoryIds = subProcessData
            .filter((sp) => sp.isMandatory)
            .map((sp) => sp.id);

          const nextSelection = Array.from(
            new Set([...selectedSubProcesses, ...mandatoryIds])
          );

          if (!sameStringSet(nextSelection, selectedSubProcesses)) {
            if (DEBUG_REACT_185) {
              console.log('[react185] StepSubProcessSelection auto-select mandatory', {
                processId,
                prev: selectedSubProcesses,
                next: nextSelection,
              });
            }
            onSelectionChange(nextSelection, subProcessData);
          }
        }
      } catch (error) {
        console.error('Error fetching sub-processes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubProcesses();
  }, [processId, selectedSubProcesses, onSelectionChange]);

  const toggleSelection = (subProcessId: string, isMandatory?: boolean) => {
    if (isMandatory) return; // Can't deselect mandatory

    const newSelection = selectedSubProcesses.includes(subProcessId)
      ? selectedSubProcesses.filter((id) => id !== subProcessId)
      : [...selectedSubProcesses, subProcessId];

    onSelectionChange(newSelection, subProcesses);
  };

  const getAssignmentLabel = (type?: string) => {
    switch (type) {
      case 'user':
        return 'Affectation directe';
      case 'manager':
        return 'Via manager';
      case 'role':
        return 'Par rôle';
      default:
        return 'Standard';
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold mb-2">
          Quelles tâches souhaitez-vous déclencher ?
        </h2>
        <p className="text-muted-foreground">
          Sélectionnez les sous-processus à inclure dans votre demande
        </p>
        {processName && (
          <Badge variant="secondary" className="mt-3 gap-2">
            <GitBranch className="h-3 w-3" />
            {processName}
          </Badge>
        )}
      </div>

      {selectedSubProcesses.length === 0 && !isLoading && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="text-sm">
            Veuillez sélectionner au moins un sous-processus pour continuer
          </span>
        </div>
      )}

      <ScrollArea className="h-[400px] pr-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : subProcesses.length === 0 ? (
          <div className="text-center py-12">
            <GitBranch className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">
              Ce processus n'a pas de sous-processus configurés
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {subProcesses.map((sp) => {
              const isSelected = selectedSubProcesses.includes(sp.id);

              return (
                <Card
                  key={sp.id}
                  className={cn(
                    'cursor-pointer transition-all',
                    isSelected
                      ? 'ring-2 ring-primary border-primary bg-primary/5'
                      : 'hover:border-primary/50',
                    sp.isMandatory && 'cursor-default'
                  )}
                  onClick={() => toggleSelection(sp.id, sp.isMandatory)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        disabled={sp.isMandatory}
                        className="mt-1"
                        onCheckedChange={() => toggleSelection(sp.id, sp.isMandatory)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">{sp.name}</span>
                          {sp.isMandatory && (
                            <Badge variant="destructive" className="text-xs shrink-0">
                              Obligatoire
                            </Badge>
                          )}
                        </div>
                        {sp.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {sp.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs gap-1">
                            {sp.assignment_type === 'user' ? (
                              <User className="h-3 w-3" />
                            ) : (
                              <Users className="h-3 w-3" />
                            )}
                            {getAssignmentLabel(sp.assignment_type)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <div className="flex justify-between items-center text-sm text-muted-foreground border-t pt-4">
        <span>
          {selectedSubProcesses.length} sous-processus sélectionné(s) sur {subProcesses.length}
        </span>
        {subProcesses.filter((sp) => sp.isMandatory).length > 0 && (
          <span className="text-amber-600">
            * Les éléments obligatoires ne peuvent pas être désélectionnés
          </span>
        )}
      </div>
    </div>
  );
}
