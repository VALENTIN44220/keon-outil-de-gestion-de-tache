import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  CheckCircle2, 
  XCircle, 
  UserPlus, 
  RefreshCw, 
  MoreVertical, 
  Play, 
  Pause,
  Send,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import type { Task, TaskStatus } from '@/types/task';

interface ContextualActionButtonsProps {
  task: Task;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onRefresh?: () => void;
  isRequest?: boolean;
  hasValidation?: boolean;
  validationLevel?: number;
  className?: string;
}

export function ContextualActionButtons({
  task,
  onStatusChange,
  onRefresh,
  isRequest = false,
  hasValidation = false,
  validationLevel = 0,
  className,
}: ContextualActionButtonsProps) {
  const { profile: currentUser } = useAuth();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ action: string; status?: TaskStatus } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAction = async () => {
    if (!pendingAction || !currentUser) return;

    setIsSubmitting(true);
    try {
      if (pendingAction.status) {
        // Status change
        const { error } = await supabase
          .from('tasks')
          .update({ status: pendingAction.status, updated_at: new Date().toISOString() })
          .eq('id', task.id);

        if (error) throw error;

        // Emit workflow event
        await supabase.from('workflow_events').insert({
          event_type: 'task_status_changed',
          entity_type: 'task',
          entity_id: task.id,
          triggered_by: currentUser.id,
          payload: {
            from_status: task.status,
            to_status: pendingAction.status,
            task_title: task.title,
          },
        });

        onStatusChange(task.id, pendingAction.status);
        toast.success('Statut mis à jour');
      } else if (pendingAction.action === 'validate') {
        // Validation approval
        await handleValidation(true);
      } else if (pendingAction.action === 'reject') {
        // Validation rejection
        await handleValidation(false);
      }

      onRefresh?.();
    } catch (error) {
      console.error('Error performing action:', error);
      toast.error('Erreur lors de l\'action');
    } finally {
      setIsSubmitting(false);
      setIsConfirmOpen(false);
      setPendingAction(null);
    }
  };

  const handleValidation = async (approved: boolean) => {
    if (!currentUser) return;

    // Update task status based on decision
    const newStatus: TaskStatus = approved ? 
      (validationLevel === 1 && hasValidation ? 'pending_validation_2' : 'validated') :
      'refused';

    await supabase
      .from('tasks')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', task.id);

    // Emit validation event
    await supabase.from('workflow_events').insert({
      event_type: 'validation_decided',
      entity_type: 'validation',
      entity_id: task.id,
      triggered_by: currentUser.id,
      payload: {
        decision: approved ? 'approved' : 'rejected',
        level: validationLevel,
        task_title: task.title,
      },
    });

    onStatusChange(task.id, newStatus);
    toast.success(approved ? 'Validation approuvée' : 'Validation refusée');
  };

  const confirmAction = (action: string, status?: TaskStatus) => {
    setPendingAction({ action, status });
    setIsConfirmOpen(true);
  };

  const getConfirmMessage = () => {
    if (!pendingAction) return { title: '', description: '' };

    switch (pendingAction.action) {
      case 'complete':
        return {
          title: 'Marquer comme terminé ?',
          description: 'Cette action marquera la tâche comme terminée. Les notifications de clôture seront envoyées.',
        };
      case 'validate':
        return {
          title: 'Approuver la validation ?',
          description: 'Vous confirmez que le travail est conforme aux attentes.',
        };
      case 'reject':
        return {
          title: 'Refuser la validation ?',
          description: 'La tâche sera renvoyée pour correction. Un commentaire explicatif est recommandé.',
        };
      case 'start':
        return {
          title: 'Démarrer la tâche ?',
          description: 'Le statut passera à "En cours".',
        };
      default:
        return {
          title: 'Confirmer l\'action ?',
          description: 'Êtes-vous sûr de vouloir effectuer cette action ?',
        };
    }
  };

  // Determine which buttons to show based on task status
  const renderButtons = () => {
    const status = task.status;

    // Pending validation states
    if (status === 'pending_validation_1' || status === 'pending_validation_2') {
      return (
        <div className="flex gap-2">
          <Button
            size="sm"
            className="bg-success hover:bg-success/90 text-success-foreground"
            onClick={() => confirmAction('validate')}
          >
            <ThumbsUp className="h-4 w-4 mr-2" />
            Approuver
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => confirmAction('reject')}
          >
            <ThumbsDown className="h-4 w-4 mr-2" />
            Refuser
          </Button>
        </div>
      );
    }

    // To assign state
    if (status === 'to_assign') {
      return (
        <Button
          size="sm"
          onClick={() => confirmAction('assign', 'todo')}
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Affecter
        </Button>
      );
    }

    // Todo state
    if (status === 'todo') {
      return (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => confirmAction('start', 'in-progress')}
          >
            <Play className="h-4 w-4 mr-2" />
            Démarrer
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => confirmAction('complete', 'done')}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Marquer terminé
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    }

    // In progress state
    if (status === 'in-progress') {
      return (
        <div className="flex gap-2">
          {hasValidation ? (
            <Button
              size="sm"
              onClick={() => confirmAction('request_validation', 'pending_validation_1')}
            >
              <Send className="h-4 w-4 mr-2" />
              Soumettre validation
            </Button>
          ) : (
            <Button
              size="sm"
              className="bg-success hover:bg-success/90 text-success-foreground"
              onClick={() => confirmAction('complete', 'done')}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Terminer
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => confirmAction('pause', 'todo')}>
                <Pause className="h-4 w-4 mr-2" />
                Mettre en pause
              </DropdownMenuItem>
              {!hasValidation && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => confirmAction('complete', 'done')}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Terminer
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    }

    // Review state
    if (status === 'review') {
      return (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => confirmAction('resume', 'in-progress')}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reprendre
          </Button>
        </div>
      );
    }

    // Refused state
    if (status === 'refused') {
      return (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => confirmAction('retry', 'todo')}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reprendre
          </Button>
        </div>
      );
    }

    // Done or validated - no actions needed
    return null;
  };

  const confirmMessage = getConfirmMessage();

  return (
    <>
      <div className={className}>
        {renderButtons()}
      </div>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmMessage.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmMessage.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleAction} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
