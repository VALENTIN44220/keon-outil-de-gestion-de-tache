import { useState } from 'react';
import { Task } from '@/types/task';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle, XCircle, Clock, ClipboardCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useSubProcessFinalRejectionPolicy } from '@/hooks/useSubProcessFinalRejectionPolicy';
import { rejectValidationWithExecutorPolicy } from '@/services/taskStatusService';

interface PendingTaskValidationsPanelProps {
  tasks: Task[];
  isLoading: boolean;
  onRefresh: () => void;
  onTaskClick?: (task: Task) => void;
}

export function PendingTaskValidationsPanel({
  tasks,
  isLoading,
  onRefresh,
  onTaskClick,
}: PendingTaskValidationsPanelProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [actionDialog, setActionDialog] = useState<{
    type: 'approve' | 'refuse';
    task: Task;
  } | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const returnsToExecutorOnReject = useSubProcessFinalRejectionPolicy(
    actionDialog?.task?.source_sub_process_template_id ?? undefined,
  );

  const getLevel = (task: Task): 1 | 2 => {
    return task.status === 'pending_validation_2' ? 2 : 1;
  };

  const handleApprove = async () => {
    if (!actionDialog || !profile?.id) return;
    setIsSubmitting(true);

    const task = actionDialog.task;
    const level = getLevel(task);
    const needsLevel2 = level === 1 && task.validation_level_2 !== 'none';
    const newStatus = needsLevel2 ? 'pending_validation_2' : 'validated';

    try {
      const updates: Record<string, unknown> = {
        status: newStatus,
        [`validation_${level}_status`]: 'validated',
        [`validation_${level}_at`]: new Date().toISOString(),
        [`validation_${level}_by`]: profile.id,
        [`validation_${level}_comment`]: comment || null,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'validated') {
        updates.validated_at = new Date().toISOString();
      }

      const { error } = await (supabase as any)
        .from('tasks')
        .update(updates)
        .eq('id', task.id);

      if (error) throw error;

      toast({ title: 'Tâche validée', description: newStatus === 'validated' ? 'La tâche a été marquée comme validée.' : 'Passage à la validation niveau 2.' });
      setActionDialog(null);
      setComment('');
      onRefresh();
    } catch (err) {
      console.error('Error approving task:', err);
      toast({ title: 'Erreur', description: 'Impossible de valider la tâche.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefuse = async () => {
    if (!actionDialog || !profile?.id) return;
    if (!comment.trim()) {
      toast({ title: 'Commentaire requis', description: 'Veuillez justifier le refus.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);

    const task = actionDialog.task;
    const level = getLevel(task);

    try {
      const result = await rejectValidationWithExecutorPolicy(
        task.id,
        level,
        profile.id,
        comment,
        returnsToExecutorOnReject,
      );
      if (!result.success) throw new Error(result.error);

      toast({
        title: returnsToExecutorOnReject ? 'Tâche non validée' : 'Refus enregistré',
        description: returnsToExecutorOnReject
          ? 'La tâche a été renvoyée à l’assigné pour correction.'
          : 'Le refus a été enregistré (sans retour automatique vers l’exécution).',
      });
      setActionDialog(null);
      setComment('');
      onRefresh();
    } catch (err) {
      console.error('Error refusing task:', err);
      toast({ title: 'Erreur', description: 'Impossible de refuser la tâche.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="w-16 h-16 bg-success/20 rounded-xl flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-success" />
        </div>
        <p className="text-muted-foreground font-medium">Aucune tâche en attente de validation</p>
        <p className="text-sm text-muted-foreground mt-1">Vous êtes à jour ! 🎉</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {tasks.map((task) => {
          const level = getLevel(task);
          return (
            <Card key={task.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <ClipboardCheck className="h-4 w-4 text-primary flex-shrink-0" />
                      <button
                        onClick={() => onTaskClick?.(task)}
                        className="font-medium text-sm text-foreground hover:text-primary truncate text-left"
                      >
                        {task.title}
                      </button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {task.task_number && (
                        <Badge variant="outline" className="text-[10px]">
                          {task.task_number}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        Niveau {level}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(task.created_at), 'dd MMM yyyy', { locale: fr })}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                        {task.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="default"
                      className="gap-1 bg-success hover:bg-success/90 text-success-foreground text-xs"
                      onClick={() => {
                        setComment('');
                        setActionDialog({ type: 'approve', task });
                      }}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Valider
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10 text-xs"
                      onClick={() => {
                        setComment('');
                        setActionDialog({ type: 'refuse', task });
                      }}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      {task.source_sub_process_template_id ? 'Non validée' : 'Refuser'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.type === 'approve' ? 'Valider la tâche' : 'Refuser la tâche'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {actionDialog?.task.title}
            </p>
            <Textarea
              placeholder={
                actionDialog?.type === 'approve'
                  ? 'Commentaire (optionnel)...'
                  : 'Justification du refus (obligatoire)...'
              }
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Annuler
            </Button>
            {actionDialog?.type === 'approve' && (
              <Button
                onClick={handleApprove}
                disabled={isSubmitting}
                className="bg-success hover:bg-success/90 text-success-foreground"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Valider
              </Button>
            )}
            {actionDialog?.type === 'refuse' && (
              <Button
                onClick={handleRefuse}
                disabled={isSubmitting}
                variant="destructive"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {actionDialog.task.source_sub_process_template_id ? 'Tâche non validée' : 'Refuser'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
