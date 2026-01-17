import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { 
  Send, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Lock,
  User,
  Users
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ValidationLevelType } from '@/types/task';

interface TaskValidationWorkflowProps {
  taskId: string;
  status: string;
  validationLevel1: ValidationLevelType;
  validationLevel2: ValidationLevelType;
  validatorLevel1Id: string | null;
  validatorLevel2Id: string | null;
  validation1Status: string;
  validation2Status: string;
  validation1Comment: string | null;
  validation2Comment: string | null;
  assigneeId: string | null;
  requesterId: string | null;
  isLockedForValidation: boolean;
  onUpdate: () => void;
}

const VALIDATION_TYPE_LABELS: Record<ValidationLevelType, string> = {
  none: 'Aucune',
  manager: 'Manager',
  requester: 'Demandeur',
  free: 'Libre',
};

export function TaskValidationWorkflow({
  taskId,
  status,
  validationLevel1,
  validationLevel2,
  validatorLevel1Id,
  validatorLevel2Id,
  validation1Status,
  validation2Status,
  validation1Comment,
  validation2Comment,
  assigneeId,
  requesterId,
  isLockedForValidation,
  onUpdate,
}: TaskValidationWorkflowProps) {
  const { profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showValidateDialog, setShowValidateDialog] = useState(false);
  const [showRefuseDialog, setShowRefuseDialog] = useState(false);
  const [comment, setComment] = useState('');
  const [currentLevel, setCurrentLevel] = useState<1 | 2>(1);

  const requiresValidation = validationLevel1 !== 'none' || validationLevel2 !== 'none';
  const isAssignee = profile?.id === assigneeId;
  
  // Check if current user can validate at each level
  const canValidateLevel1 = (() => {
    if (status !== 'pending_validation_1') return false;
    if (validationLevel1 === 'manager') {
      // Check if current user is manager of the assignee
      return profile?.id && profile.id !== assigneeId;
    }
    if (validationLevel1 === 'requester') {
      return profile?.id === requesterId;
    }
    if (validationLevel1 === 'free') {
      return profile?.id === validatorLevel1Id;
    }
    return false;
  })();

  const canValidateLevel2 = (() => {
    if (status !== 'pending_validation_2') return false;
    if (validationLevel2 === 'manager') {
      return profile?.id && profile.id !== assigneeId;
    }
    if (validationLevel2 === 'requester') {
      return profile?.id === requesterId;
    }
    if (validationLevel2 === 'free') {
      return profile?.id === validatorLevel2Id;
    }
    return false;
  })();

  // Send for validation (by assignee)
  const handleSendForValidation = async () => {
    if (!isAssignee) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'pending_validation_1',
          original_assignee_id: assigneeId,
          is_locked_for_validation: true,
          validation_1_status: 'pending',
        })
        .eq('id', taskId);

      if (error) throw error;
      
      toast.success('Tâche envoyée pour validation');
      onUpdate();
    } catch (error) {
      console.error('Error sending for validation:', error);
      toast.error('Erreur lors de l\'envoi pour validation');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Validate a level
  const handleValidate = async () => {
    setIsSubmitting(true);
    try {
      const level = status === 'pending_validation_1' ? 1 : 2;
      const hasLevel2 = validationLevel2 !== 'none';
      
      let newStatus: string;
      if (level === 1 && hasLevel2) {
        newStatus = 'pending_validation_2';
      } else {
        newStatus = 'validated';
      }

      const updates: Record<string, any> = {
        status: newStatus,
        [`validation_${level}_status`]: 'validated',
        [`validation_${level}_at`]: new Date().toISOString(),
        [`validation_${level}_by`]: profile?.id,
        [`validation_${level}_comment`]: comment || null,
      };

      // If fully validated, unlock the task
      if (newStatus === 'validated') {
        updates.is_locked_for_validation = false;
        updates.validated_at = new Date().toISOString();
        updates.validator_id = profile?.id;
      }

      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId);

      if (error) throw error;
      
      toast.success(newStatus === 'validated' ? 'Tâche validée' : 'Validation niveau 1 effectuée');
      setShowValidateDialog(false);
      setComment('');
      onUpdate();
    } catch (error) {
      console.error('Error validating:', error);
      toast.error('Erreur lors de la validation');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Refuse validation
  const handleRefuse = async () => {
    if (!comment.trim()) {
      toast.error('Veuillez ajouter un commentaire pour expliquer le refus');
      return;
    }

    setIsSubmitting(true);
    try {
      const level = status === 'pending_validation_1' ? 1 : 2;
      
      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'refused',
          [`validation_${level}_status`]: 'refused',
          [`validation_${level}_at`]: new Date().toISOString(),
          [`validation_${level}_by`]: profile?.id,
          [`validation_${level}_comment`]: comment,
          is_locked_for_validation: false,
        })
        .eq('id', taskId);

      if (error) throw error;
      
      toast.success('Tâche refusée');
      setShowRefuseDialog(false);
      setComment('');
      onUpdate();
    } catch (error) {
      console.error('Error refusing:', error);
      toast.error('Erreur lors du refus');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!requiresValidation) {
    return null;
  }

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Workflow de validation</span>
      </div>

      {/* Validation Levels Display */}
      <div className="space-y-2">
        {validationLevel1 !== 'none' && (
          <div className="flex items-center justify-between p-2 rounded bg-background">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Niveau 1</Badge>
              <span className="text-sm">{VALIDATION_TYPE_LABELS[validationLevel1]}</span>
            </div>
            {validation1Status === 'validated' && (
              <Badge className="bg-green-500/10 text-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Validé
              </Badge>
            )}
            {validation1Status === 'refused' && (
              <Badge className="bg-red-500/10 text-red-600">
                <XCircle className="h-3 w-3 mr-1" />
                Refusé
              </Badge>
            )}
            {validation1Status === 'pending' && status === 'pending_validation_1' && (
              <Badge className="bg-yellow-500/10 text-yellow-600">
                <Clock className="h-3 w-3 mr-1" />
                En attente
              </Badge>
            )}
          </div>
        )}

        {validationLevel2 !== 'none' && (
          <div className="flex items-center justify-between p-2 rounded bg-background">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Niveau 2</Badge>
              <span className="text-sm">{VALIDATION_TYPE_LABELS[validationLevel2]}</span>
            </div>
            {validation2Status === 'validated' && (
              <Badge className="bg-green-500/10 text-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Validé
              </Badge>
            )}
            {validation2Status === 'refused' && (
              <Badge className="bg-red-500/10 text-red-600">
                <XCircle className="h-3 w-3 mr-1" />
                Refusé
              </Badge>
            )}
            {validation2Status === 'pending' && status === 'pending_validation_2' && (
              <Badge className="bg-yellow-500/10 text-yellow-600">
                <Clock className="h-3 w-3 mr-1" />
                En attente
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Comments display */}
      {validation1Comment && (
        <div className="text-xs p-2 bg-muted rounded">
          <span className="font-medium">Commentaire N1:</span> {validation1Comment}
        </div>
      )}
      {validation2Comment && (
        <div className="text-xs p-2 bg-muted rounded">
          <span className="font-medium">Commentaire N2:</span> {validation2Comment}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap">
        {/* Send for validation button (for assignee when task is done) */}
        {isAssignee && status === 'done' && !isLockedForValidation && (
          <Button 
            size="sm" 
            onClick={handleSendForValidation}
            disabled={isSubmitting}
          >
            <Send className="h-4 w-4 mr-2" />
            Envoyer pour validation
          </Button>
        )}

        {/* Locked indicator */}
        {isLockedForValidation && isAssignee && (
          <Badge variant="outline" className="text-muted-foreground">
            <Lock className="h-3 w-3 mr-1" />
            En attente de validation
          </Badge>
        )}

        {/* Validate buttons for validators */}
        {(canValidateLevel1 || canValidateLevel2) && (
          <>
            <Button 
              size="sm" 
              variant="default"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => setShowValidateDialog(true)}
              disabled={isSubmitting}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Valider
            </Button>
            <Button 
              size="sm" 
              variant="destructive"
              onClick={() => setShowRefuseDialog(true)}
              disabled={isSubmitting}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Refuser
            </Button>
          </>
        )}
      </div>

      {/* Validate Dialog */}
      <Dialog open={showValidateDialog} onOpenChange={setShowValidateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Valider la tâche</DialogTitle>
            <DialogDescription>
              {status === 'pending_validation_1' && validationLevel2 !== 'none'
                ? 'Validez ce niveau pour passer au niveau 2'
                : 'Validez pour terminer le workflow'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                Commentaire (optionnel)
              </label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Ajouter un commentaire..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowValidateDialog(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleValidate} 
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              Confirmer la validation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refuse Dialog */}
      <Dialog open={showRefuseDialog} onOpenChange={setShowRefuseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser la tâche</DialogTitle>
            <DialogDescription>
              Expliquez la raison du refus
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                Commentaire (obligatoire)
              </label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Raison du refus..."
                rows={3}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRefuseDialog(false)}>
              Annuler
            </Button>
            <Button 
              variant="destructive"
              onClick={handleRefuse} 
              disabled={isSubmitting || !comment.trim()}
            >
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
