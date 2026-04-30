import { useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Props {
  waitingId: string | null;
  supplierName: string | null;
  onClose: () => void;
  onRejected: () => void;
}

export function SupplierWaitingRejectDialog({ waitingId, supplierName, onClose, onRejected }: Props) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const open = !!waitingId;

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!waitingId || reason.trim() === '') return;

    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('reject_supplier_waiting', {
        p_waiting_id: waitingId,
        p_reason: reason.trim(),
      });
      if (error) throw error;
      toast({
        title: 'Demande refusée',
        description: `La demande de « ${supplierName ?? 'ce fournisseur'} » a été refusée. Le demandeur a été notifié.`,
      });
      setReason('');
      onRejected();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Impossible de refuser la demande';
      toast({ title: 'Erreur', description: msg, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (o: boolean) => {
    if (!o && !submitting) {
      setReason('');
      onClose();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Refuser la demande fournisseur</AlertDialogTitle>
          <AlertDialogDescription>
            La demande de{' '}
            <span className="font-semibold text-foreground">
              {supplierName ?? 'ce fournisseur'}
            </span>{' '}
            sera refusée. Le demandeur recevra une notification avec votre motif.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="reject-reason" className="text-sm font-medium">
            Motif du refus <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Expliquez pourquoi cette demande est refusée…"
            rows={4}
            disabled={submitting}
            className="resize-none"
          />
          {reason.trim() === '' && (
            <p className="text-xs text-muted-foreground">Le motif est obligatoire.</p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={submitting || reason.trim() === ''}
            onClick={handleConfirm}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Confirmer le refus
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
