import { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Archive } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

interface DeleteProcessDialogProps {
  processId: string | null;
  processName: string;
  open: boolean;
  onClose: () => void;
  onConfirmDelete: () => void;
  onConfirmArchive?: () => void;
}

interface ConstraintCheck {
  hasActiveRequests: boolean;
  activeRequestCount: number;
  hasSubProcesses: boolean;
  subProcessCount: number;
  hasWorkflow: boolean;
}

export function DeleteProcessDialog({
  processId,
  processName,
  open,
  onClose,
  onConfirmDelete,
  onConfirmArchive,
}: DeleteProcessDialogProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [constraints, setConstraints] = useState<ConstraintCheck | null>(null);

  useEffect(() => {
    if (!open || !processId) {
      setConstraints(null);
      return;
    }

    const checkConstraints = async () => {
      setIsChecking(true);
      try {
        // Check for active requests using this process
        const { data: requests } = await supabase
          .from('tasks')
          .select('id, status')
          .eq('process_template_id', processId);
        
        const activeRequests = (requests || []).filter(
          r => r.status !== 'done' && r.status !== 'cancelled'
        );

        // Check for sub-processes
        const { data: subProcesses } = await supabase
          .from('sub_process_templates')
          .select('id')
          .eq('process_template_id', processId);

        // Check for workflow
        const { data: workflow } = await supabase
          .from('workflow_templates')
          .select('id')
          .eq('process_template_id', processId)
          .maybeSingle();

        setConstraints({
          hasActiveRequests: activeRequests.length > 0,
          activeRequestCount: activeRequests.length,
          hasSubProcesses: (subProcesses?.length || 0) > 0,
          subProcessCount: subProcesses?.length || 0,
          hasWorkflow: !!workflow,
        });
      } catch (error) {
        console.error('Error checking constraints:', error);
        setConstraints({
          hasActiveRequests: false,
          activeRequestCount: 0,
          hasSubProcesses: false,
          subProcessCount: 0,
          hasWorkflow: false,
        });
      } finally {
        setIsChecking(false);
      }
    };

    checkConstraints();
  }, [open, processId]);

  const canDelete = constraints && !constraints.hasActiveRequests;

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Confirmer la suppression
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Voulez-vous vraiment supprimer le processus{' '}
                <span className="font-semibold text-foreground">"{processName}"</span> ?
              </p>

              {isChecking ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Vérification des contraintes...
                </div>
              ) : constraints ? (
                <div className="space-y-2 text-sm">
                  {constraints.hasActiveRequests && (
                    <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded-md border border-destructive/30">
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                      <span>
                        <strong>{constraints.activeRequestCount} demande(s) active(s)</strong> utilisent ce processus.
                        La suppression n'est pas possible.
                      </span>
                    </div>
                  )}

                  {constraints.hasSubProcesses && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{constraints.subProcessCount} sous-processus</Badge>
                      <span className="text-muted-foreground">seront également supprimés</span>
                    </div>
                  )}

                  {constraints.hasWorkflow && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Workflow configuré</Badge>
                      <span className="text-muted-foreground">sera supprimé</span>
                    </div>
                  )}

                  {!constraints.hasActiveRequests && !constraints.hasSubProcesses && !constraints.hasWorkflow && (
                    <p className="text-muted-foreground">
                      Ce processus peut être supprimé en toute sécurité.
                    </p>
                  )}
                </div>
              ) : null}

              {!isChecking && !canDelete && (
                <p className="text-sm text-muted-foreground mt-2">
                  Vous pouvez archiver ce processus pour le masquer sans le supprimer.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          
          {!isChecking && !canDelete && onConfirmArchive && (
            <Button
              variant="outline"
              onClick={() => {
                onConfirmArchive();
                onClose();
              }}
              className="gap-2"
            >
              <Archive className="h-4 w-4" />
              Archiver
            </Button>
          )}
          
          <AlertDialogAction
            onClick={() => {
              onConfirmDelete();
              onClose();
            }}
            disabled={isChecking || !canDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isChecking ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
