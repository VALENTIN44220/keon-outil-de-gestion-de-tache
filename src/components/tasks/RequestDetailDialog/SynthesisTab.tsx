import { useState, useEffect } from 'react';
import { Task } from '@/types/task';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Building2, 
  Calendar, 
  User, 
  Workflow,
  CheckCircle2,
  Clock,
  AlertCircle,
  Layers,
  History,
  Hash,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { SubProcessGroup, priorityConfig, statusConfig } from './types';
import { AuditTimeline } from '@/components/execution/AuditTimeline';
import { MaterialRequestSection } from '@/components/maintenance/MaterialRequestSection';
import { supabase } from '@/integrations/supabase/client';

interface FieldValue {
  id: string;
  field_id: string;
  value: string | null;
  file_url: string | null;
  field_label: string;
  field_type: string;
  field_name: string;
}

interface SynthesisTabProps {
  task: Task;
  processName: string | null;
  profiles: Map<string, string>;
  departments: Map<string, string>;
  subProcessGroups: SubProcessGroup[];
  globalProgress: number;
  onSelectSubProcess: (subProcessId: string) => void;
}

export function SynthesisTab({
  task,
  processName,
  profiles,
  departments,
  subProcessGroups,
  globalProgress,
  onSelectSubProcess,
}: SynthesisTabProps) {
  const [fieldValues, setFieldValues] = useState<FieldValue[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(false);

  useEffect(() => {
    const fetchCustomFields = async () => {
      setIsLoadingFields(true);
      try {
        const { data } = await supabase
          .from('request_field_values')
          .select('id, field_id, value, file_url, template_custom_fields!inner(label, field_type, name)')
          .eq('task_id', task.id);

        if (data) {
          setFieldValues(data.map((fv: any) => ({
            id: fv.id,
            field_id: fv.field_id,
            value: fv.value,
            file_url: fv.file_url,
            field_label: fv.template_custom_fields?.label || 'Champ',
            field_type: fv.template_custom_fields?.field_type || 'text',
            field_name: fv.template_custom_fields?.name || '',
          })));
        }
      } catch (error) {
        console.error('Error fetching custom fields:', error);
      } finally {
        setIsLoadingFields(false);
      }
    };
    fetchCustomFields();
  }, [task.id]);

  const renderFieldValue = (fv: FieldValue) => {
    if (fv.field_type === 'checkbox') {
      return fv.value === 'true' ? (
        <Badge variant="default" className="text-xs">Oui</Badge>
      ) : (
        <Badge variant="secondary" className="text-xs">Non</Badge>
      );
    }
    if (fv.field_type === 'file' && fv.file_url) {
      return (
        <a href={fv.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">
          Voir le fichier
        </a>
      );
    }
    return <span className="text-sm">{fv.value || '-'}</span>;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done': return CheckCircle2;
      case 'in-progress': return Clock;
      default: return AlertCircle;
    }
  };

  const getGroupStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-success/10 border-success/30 text-success';
      case 'in-progress': return 'bg-info/10 border-info/30 text-info';
      default: return 'bg-muted border-border text-muted-foreground';
    }
  };

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-6">
        {/* Request Number - Prominent display */}
        {task.request_number && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <Hash className="h-5 w-5 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">Numéro de demande</div>
              <div className="font-mono font-semibold text-lg">{task.request_number}</div>
            </div>
          </div>
        )}

        {/* Description */}
        {task.description && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
            <p className="text-sm whitespace-pre-wrap">{task.description}</p>
          </div>
        )}

        {/* Material Request Lines */}
        <MaterialRequestSection requestId={task.id} />

        {/* Metadata - Read only, from process/request */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {task.due_date && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Échéance: {format(new Date(task.due_date), 'dd MMMM yyyy', { locale: fr })}</span>
            </div>
          )}
          {task.target_department_id && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span>Service: {departments.get(task.target_department_id) || 'N/A'}</span>
            </div>
          )}
          {task.requester_id && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>Demandeur: {profiles.get(task.requester_id) || 'N/A'}</span>
            </div>
          )}
          {task.category && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Catégorie:</span>
              <Badge variant="outline">{task.category}</Badge>
            </div>
          )}
        </div>

        {/* Process info */}
        {processName && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2">
              <Workflow className="h-5 w-5 text-primary" />
              <span className="font-medium">Processus: {processName}</span>
            </div>
          </div>
        )}

        {/* Global progress */}
        {subProcessGroups.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Avancement global
              </h4>
              <span className="text-sm font-medium">{globalProgress}%</span>
            </div>
            <Progress value={globalProgress} className="h-3" />
          </div>
        )}

        {/* Sub-process summary cards */}
        {subProcessGroups.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground">Sous-processus associés</h4>
            <div className="grid gap-3">
              {subProcessGroups.map((group) => {
                const StatusIcon = getStatusIcon(group.status);
                return (
                  <div
                    key={group.subProcessId}
                    onClick={() => onSelectSubProcess(group.subProcessId)}
                    className={cn(
                      "p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md",
                      getGroupStatusColor(group.status)
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <StatusIcon className="h-4 w-4" />
                        <span className="font-medium">{group.subProcessName}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {group.completedCount}/{group.totalCount} tâches
                      </Badge>
                    </div>
                    {group.departmentName && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                        <Building2 className="h-3 w-3" />
                        {group.departmentName}
                      </div>
                    )}
                    <Progress value={group.progressPercent} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Show assignee only if no sub-processes */}
        {subProcessGroups.length === 0 && task.assignee_id && (
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span>Exécutant: {profiles.get(task.assignee_id) || 'N/A'}</span>
          </div>
        )}

        {/* Custom Fields */}
        {isLoadingFields ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : fieldValues.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground">Détail de la demande</h4>
              <div className="grid grid-cols-2 gap-3">
                {fieldValues.map((fv) => (
                  <div key={fv.id} className={fv.field_type === 'textarea' ? 'col-span-2' : ''}>
                    <label className="text-xs font-medium text-muted-foreground">{fv.field_label}</label>
                    <div className="mt-1">{renderFieldValue(fv)}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Audit Timeline */}
        <Separator />
        <AuditTimeline requestId={task.id} maxHeight="250px" />
      </div>
    </ScrollArea>
  );
}
