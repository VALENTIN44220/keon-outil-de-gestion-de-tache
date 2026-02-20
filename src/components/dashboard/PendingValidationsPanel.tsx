import { useState } from 'react';
import { Task } from '@/types/task';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle, XCircle, Clock, RotateCcw, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { validateRequest, refuseRequest } from '@/services/requestValidationService';
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

interface PendingValidationsPanelProps {
  requests: Task[];
  isLoading: boolean;
  onRefresh: () => void;
  onRequestClick?: (request: Task) => void;
}

export function PendingValidationsPanel({
  requests,
  isLoading,
  onRefresh,
  onRequestClick,
}: PendingValidationsPanelProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [actionDialog, setActionDialog] = useState<{
    type: 'approve' | 'refuse_cancel' | 'refuse_return';
    request: Task;
  } | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getLevel = (request: Task): 1 | 2 => {
    return request.request_validation_status === 'pending_level_2' ? 2 : 1;
  };

  const handleApprove = async () => {
    if (!actionDialog || !profile?.id) return;
    setIsSubmitting(true);
    const result = await validateRequest(
      actionDialog.request.id,
      getLevel(actionDialog.request),
      profile.id,
      comment || undefined
    );
    setIsSubmitting(false);
    if (result.success) {
      toast({ title: 'Demande approuvée', description: 'La validation a été enregistrée.' });
      setActionDialog(null);
      setComment('');
      onRefresh();
    } else {
      toast({ title: 'Erreur', description: result.error, variant: 'destructive' });
    }
  };

  const handleRefuse = async (action: 'cancel' | 'return') => {
    if (!actionDialog || !profile?.id) return;
    if (!comment.trim()) {
      toast({ title: 'Commentaire requis', description: 'Veuillez justifier le refus.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    const result = await refuseRequest(
      actionDialog.request.id,
      getLevel(actionDialog.request),
      profile.id,
      action,
      comment
    );
    setIsSubmitting(false);
    if (result.success) {
      toast({
        title: action === 'cancel' ? 'Demande annulée' : 'Demande retournée',
        description: action === 'cancel' ? 'La demande a été annulée.' : 'La demande a été retournée au demandeur.',
      });
      setActionDialog(null);
      setComment('');
      onRefresh();
    } else {
      toast({ title: 'Erreur', description: result.error, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="w-16 h-16 bg-success/20 rounded-xl flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-success" />
        </div>
        <p className="text-muted-foreground font-medium">Aucune demande en attente de validation</p>
        <p className="text-sm text-muted-foreground mt-1">Vous êtes à jour ! 🎉</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {requests.map((request) => {
          const level = getLevel(request);
          return (
            <Card key={request.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-warning flex-shrink-0" />
                      <button
                        onClick={() => onRequestClick?.(request)}
                        className="font-medium text-sm text-foreground hover:text-primary truncate text-left"
                      >
                        {request.title}
                      </button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {request.request_number && (
                        <Badge variant="outline" className="text-[10px]">
                          {request.request_number}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        Niveau {level}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(request.created_at), 'dd MMM yyyy', { locale: fr })}
                      </span>
                    </div>
                    {request.description && (
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                        {request.description}
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
                        setActionDialog({ type: 'approve', request });
                      }}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Approuver
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10 text-xs"
                      onClick={() => {
                        setComment('');
                        setActionDialog({ type: 'refuse_cancel', request });
                      }}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Refuser
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-warning border-warning/30 hover:bg-warning/10 text-xs"
                      onClick={() => {
                        setComment('');
                        setActionDialog({ type: 'refuse_return', request });
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Retourner
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
              {actionDialog?.type === 'approve' && 'Approuver la demande'}
              {actionDialog?.type === 'refuse_cancel' && 'Refuser et annuler la demande'}
              {actionDialog?.type === 'refuse_return' && 'Retourner la demande au demandeur'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {actionDialog?.request.title}
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
                Approuver
              </Button>
            )}
            {actionDialog?.type === 'refuse_cancel' && (
              <Button
                onClick={() => handleRefuse('cancel')}
                disabled={isSubmitting}
                variant="destructive"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Annuler la demande
              </Button>
            )}
            {actionDialog?.type === 'refuse_return' && (
              <Button
                onClick={() => handleRefuse('return')}
                disabled={isSubmitting}
                className="bg-warning hover:bg-warning/90 text-warning-foreground"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Retourner
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
