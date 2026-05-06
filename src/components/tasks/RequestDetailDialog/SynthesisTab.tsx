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
  Hash,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { SubProcessGroup, priorityConfig, statusConfig } from './types';
import { AuditTimeline } from '@/components/execution/AuditTimeline';
import { MaterialRequestSection } from '@/components/maintenance/MaterialRequestSection';
import { RequestCustomFieldsDisplay } from './RequestCustomFieldsDisplay';

interface SynthesisTabProps {
  task: Task;
  processName: string | null;
  profiles: Map<string, string>;
  departments: Map<string, string>;
  /** Détails enrichis du demandeur (société, service, fonction). null si pas chargés. */
  requesterDetails?: {
    company: string | null;
    department: string | null;
    job_title: string | null;
  } | null;
  subProcessGroups: SubProcessGroup[];
  globalProgress: number;
  onSelectSubProcess: (subProcessId: string) => void;
}

export function SynthesisTab({
  task,
  processName,
  profiles,
  departments,
  requesterDetails,
  subProcessGroups,
  globalProgress,
  onSelectSubProcess,
}: SynthesisTabProps) {

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
          {/* Date de création de la demande */}
          {task.created_at && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Créée le : {format(new Date(task.created_at), 'dd MMMM yyyy', { locale: fr })}</span>
            </div>
          )}
          {task.due_date && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Échéance: {format(new Date(task.due_date), 'dd MMMM yyyy', { locale: fr })}</span>
            </div>
          )}
          {task.target_department_id && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span>Service cible: {departments.get(task.target_department_id) || 'N/A'}</span>
            </div>
          )}
          {task.category && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Catégorie:</span>
              <Badge variant="outline">{task.category}</Badge>
            </div>
          )}
        </div>

        {/* Bloc demandeur enrichi (nom + société + service + fonction) */}
        {task.requester_id && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              Demandeur
            </div>
            <div className="font-medium text-sm">{profiles.get(task.requester_id) || 'N/A'}</div>
            {requesterDetails && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {requesterDetails.company && (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3 w-3" />
                    <span>{requesterDetails.company}</span>
                  </div>
                )}
                {requesterDetails.department && (
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-3 w-3" />
                    <span>{requesterDetails.department}</span>
                  </div>
                )}
                {requesterDetails.job_title && (
                  <div className="flex items-center gap-1.5 col-span-2">
                    <span className="text-muted-foreground/70">Fonction :</span>
                    <span>{requesterDetails.job_title}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
        <RequestCustomFieldsDisplay taskId={task.id} />

        {/* Audit Timeline */}
        <Separator />
        <AuditTimeline requestId={task.id} maxHeight="250px" />
      </div>
    </ScrollArea>
  );
}
