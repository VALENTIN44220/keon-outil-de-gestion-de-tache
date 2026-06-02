/**
 * ITPendingValidationsPanel — demandes IT en attente de validation par le user
 * courant (N1 = équipe IT, N2 = demandeur).
 *
 * Cloné de BEPendingValidationsPanel. Action « Valider » → niveau suivant
 * (a_valider depuis a_relire, cloturee depuis a_valider) via useITRequestStatus.
 *
 * Le complément / refus (avec commentaire) reste dans le dialog de détail.
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
import { useITRequestStatus, type ITRequestStatus } from '@/hooks/useITRequestStatus';
import type { ITPendingValidationTask } from '@/hooks/useITPendingValidations';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';

interface Props {
  tasks: ITPendingValidationTask[];
  isLoading: boolean;
  onRefresh: () => void;
}

const URGENCY_META: Record<string, { label: string; className: string }> = {
  critique: { label: '🔴 Critique', className: 'bg-red-100 text-red-700 border-red-300' },
  urgent:   { label: '🟠 Urgent',   className: 'bg-amber-100 text-amber-700 border-amber-300' },
  normal:   { label: 'Normal',       className: 'bg-slate-100 text-slate-600 border-slate-300' },
};

export function ITPendingValidationsPanel({ tasks, isLoading, onRefresh }: Props) {
  const navigate = useNavigate();
  const { updateITRequestStatus, isUpdating } = useITRequestStatus();
  const { profile: authProfile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const profileId = (isSimulating && simulatedProfile ? simulatedProfile : authProfile)?.id ?? null;
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleValidate = async (task: ITPendingValidationTask) => {
    setPendingId(task.id);
    try {
      const level = task.validation_level;
      // N1 → N2 (a_valider, dest = demandeur). N2 → cloturee.
      const status: ITRequestStatus = level === 1 ? 'a_valider' : 'cloturee';
      const label = task.prestation_name ?? task.title;
      const recipients =
        status === 'a_valider'
          ? [{ profileId: task.n2_validator_id, title: `À valider : ${label}`, message: `Une demande IT attend votre validation (N2).`, type: 'it_a_valider' }]
          : [{ profileId: task.requester_id, title: `Clôturée : ${label}`, message: `Votre demande IT a été clôturée.`, type: 'it_cloturee' }];
      const now = new Date().toISOString();
      await updateITRequestStatus({
        taskId: task.id,
        status,
        extraUpdates: {
          [`validation_${level}_status`]: 'validated',
          [`validation_${level}_at`]: now,
          [`validation_${level}_by`]: profileId,
        },
        notifyOverride: { recipients },
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
        Aucune demande IT en attente de votre validation.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const urgency = (task.it_urgency as string) ?? 'normal';
        const urgMeta = URGENCY_META[urgency] ?? URGENCY_META.normal;
        const isCurrent = pendingId === task.id;

        return (
          <Card key={task.id} className="border-indigo-300/50 bg-indigo-50/30 dark:bg-indigo-900/10">
            <CardContent className="p-3 flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-indigo-600 shrink-0" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {task.prestation_name && (
                    <Badge variant="outline" className="font-mono text-[10px] px-1.5 shrink-0">
                      {task.prestation_name}
                    </Badge>
                  )}
                  <span className="text-sm font-medium truncate">{task.title}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] px-1.5 h-4 border shrink-0',
                      task.validation_level === 2
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                        : 'bg-amber-100 text-amber-700 border-amber-300',
                    )}
                  >
                    N{task.validation_level}
                  </Badge>
                  {urgency !== 'normal' && (
                    <Badge variant="outline" className={cn('text-[10px] px-1.5 border', urgMeta.className)}>
                      {urgMeta.label}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  {task.assignee && <span>Traité par {task.assignee.display_name}</span>}
                  {task.requester && task.validation_level === 1 && (
                    <>
                      <span>·</span>
                      <span>Demandeur : {task.requester.display_name}</span>
                    </>
                  )}
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
                title="Voir dans le dispatch IT"
                onClick={() => navigate('/it/dispatch')}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>

              <Button
                size="sm"
                className="h-7 px-3 gap-1 bg-indigo-500 hover:bg-indigo-600 text-white"
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
