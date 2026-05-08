/**
 * BEPendingValidationsPanel — liste des tâches BE en attente de validation
 * (be_status='a_relire' où le user courant est dispatch_manager).
 *
 * Affiché dans le tab « Validations » du dashboard pour centraliser la vision.
 * Action « Valider » → transition `a_relire → a_valider` via useBETaskStatus
 * (notification automatique de l'assigné).
 *
 * Le bouton « Renvoyer » (a_relire → en_cours) reste disponible depuis
 * BEDispatchView via la pastille de statut interactive — pas dupliqué ici
 * pour rester focus sur l'action principale (valider).
 */
import { useState } from 'react';
import { Loader2, CheckCircle2, ExternalLink, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useBETaskStatus } from '@/hooks/useBETaskStatus';
import type { BEPendingValidationTask } from '@/hooks/useBEPendingValidations';

interface Props {
  tasks: BEPendingValidationTask[];
  isLoading: boolean;
  onRefresh: () => void;
}

const URGENCY_META: Record<string, { label: string; className: string }> = {
  critique: { label: '🔴 Critique', className: 'bg-red-100 text-red-700 border-red-300' },
  urgent:   { label: '🟠 Urgent',   className: 'bg-amber-100 text-amber-700 border-amber-300' },
  normal:   { label: 'Normal',       className: 'bg-slate-100 text-slate-600 border-slate-300' },
};

export function BEPendingValidationsPanel({ tasks, isLoading, onRefresh }: Props) {
  const navigate = useNavigate();
  const { updateBEStatus, isUpdating } = useBETaskStatus();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleValidate = async (task: BEPendingValidationTask) => {
    setPendingId(task.id);
    try {
      await updateBEStatus({
        taskId: task.id,
        status: 'a_valider',
        notify: {
          taskLabel: task.sub_process_template?.name ?? task.title,
          projectCode: task.be_project?.code_projet,
          dispatchManagerId: task.sub_process_template?.dispatch_manager_id ?? null,
          assigneeId: task.assignee_id,
        },
      });
      onRefresh();
    } finally {
      setPendingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Aucune prestation BE en attente de votre relecture.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const urgency = (task.be_urgency as string) ?? 'normal';
        const urgMeta = URGENCY_META[urgency] ?? URGENCY_META.normal;
        const isCurrent = pendingId === task.id;

        return (
          <Card key={task.id} className="border-amber-300/50 bg-amber-50/30 dark:bg-amber-900/10">
            <CardContent className="p-3 flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {task.be_project && (
                    <Badge variant="outline" className="font-mono text-[10px] px-1.5 shrink-0">
                      {task.be_project.code_projet}
                    </Badge>
                  )}
                  <span className="text-sm font-medium truncate">
                    {task.sub_process_template?.name ?? task.title}
                  </span>
                  {urgency !== 'normal' && (
                    <Badge variant="outline" className={cn('text-[10px] px-1.5 border', urgMeta.className)}>
                      {urgMeta.label}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  {task.assignee && <span>Soumis par {task.assignee.display_name}</span>}
                  {task.due_date && (
                    <>
                      <span>·</span>
                      <span>Échéance {format(new Date(task.due_date), 'dd/MM/yy', { locale: fr })}</span>
                    </>
                  )}
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground/60 hover:text-primary"
                title="Voir dans le dispatch BE"
                onClick={() => navigate('/be/dispatch')}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>

              <Button
                size="sm"
                className="h-7 px-3 gap-1 bg-amber-500 hover:bg-amber-600 text-white"
                onClick={() => handleValidate(task)}
                disabled={isUpdating || isCurrent}
              >
                {isCurrent ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                Valider
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
