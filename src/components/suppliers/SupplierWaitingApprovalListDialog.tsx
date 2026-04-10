import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useSupplierWaitingApprovalList } from '@/hooks/useSupplierWaitingApproval';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface SupplierWaitingApprovalListDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SupplierWaitingApprovalListDialog({ open, onClose }: SupplierWaitingApprovalListDialogProps) {
  const queryClient = useQueryClient();
  const { data: rows = [], isLoading, refetch, isRefetching } = useSupplierWaitingApprovalList({ enabled: open });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const { data: attachments, error: attErr } = await supabase
        .from('supplier_waiting_approval_attachments')
        .select('storage_path')
        .eq('waiting_approval_id', deleteId);
      if (attErr) throw attErr;
      const paths = (attachments ?? []).map((a) => a.storage_path).filter(Boolean);
      if (paths.length > 0) {
        const { error: storErr } = await supabase.storage.from('supplier-waiting-attachments').remove(paths);
        if (storErr) console.error(storErr);
      }
      const { error: delErr } = await supabase.from('supplier_waiting_approval').delete().eq('id', deleteId);
      if (delErr) throw delErr;
      toast({ title: 'Demande retirée de la file d’attente' });
      setDeleteId(null);
      await queryClient.invalidateQueries({ queryKey: ['supplier-waiting-approval'] });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Suppression impossible';
      toast({ title: 'Erreur', description: message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="sm:max-w-[640px] max-h-[85vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Fournisseurs en attente d’approbation
            </DialogTitle>
            <DialogDescription className="text-left">
              Classés par date de soumission. L’identifiant de ligne (<span className="font-mono text-xs">line_index</span>)
              regroupe une demande ; suppression définitive.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-3 flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
              {isRefetching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Actualiser'}
            </Button>
          </div>

          <ScrollArea className="max-h-[55vh] px-6 pb-6">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Aucune demande en attente.</p>
            ) : (
              <ul className="space-y-2">
                {rows.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-lg border border-border bg-muted/20 p-3"
                  >
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="font-medium truncate">{r.nomfournisseur || '—'}</div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                        <span>{r.entite || '—'}</span>
                        {r.famille ? <span>Famille&nbsp;: {r.famille}</span> : null}
                        {r.siret ? <span className="font-mono">SIRET {r.siret}</span> : null}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono truncate" title={r.line_index}>
                        line_index&nbsp;: {r.line_index.slice(0, 8)}…
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Soumis le{' '}
                        {r.created_at
                          ? format(new Date(r.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })
                          : '—'}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive"
                      aria-label="Supprimer la demande"
                      onClick={() => setDeleteId(r.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && !isDeleting && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette demande&nbsp;?</AlertDialogTitle>
            <AlertDialogDescription>
              Les pièces jointes stockées seront supprimées du bucket et la ligne sera effacée définitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
