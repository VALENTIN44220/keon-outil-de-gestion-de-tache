import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, AlertCircle, CheckCircle2, Clock, XCircle, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { useMySupplierRequests } from '@/hooks/useSupplierWaitingApproval';
import { SupplierWaitingDetailDrawer } from './SupplierWaitingDetailDrawer';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Si fourni, ouvre directement le détail de cette demande au montage. */
  autoOpenId?: string | null;
}

export function MySupplierRequestsDialog({ open, onClose, autoOpenId }: Props) {
  const { user } = useAuth();
  const { getActiveProfile } = useSimulation();

  // En simulation : utiliser le user_id du profil simulé, sinon le vrai user
  const activeProfile = getActiveProfile();
  const effectiveUserId = activeProfile?.user_id ?? user?.id;

  const { data: rows = [], isLoading, refetch } = useMySupplierRequests({
    enabled: open,
    userId: effectiveUserId,
  });
  const [detailId, setDetailId] = useState<string | null>(autoOpenId ?? null);

  const pendingModif = rows.filter((r) => r.status === 'modifications_demandees' && !r.rejected_at);

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-[620px] max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Mes demandes fournisseurs
            </DialogTitle>
            <DialogDescription className="text-left">
              Retrouvez ici toutes vos demandes soumises et leur statut.
              {pendingModif.length > 0 && (
                <span className="ml-1 font-semibold text-amber-700">
                  {pendingModif.length} demande{pendingModif.length > 1 ? 's' : ''} nécessite{pendingModif.length > 1 ? 'nt' : ''} des modifications.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                Vous n'avez pas encore soumis de demande.
              </p>
            ) : (
              <ul className="px-6 py-4 space-y-2">
                {rows.map((r) => {
                  const needsModif = r.status === 'modifications_demandees' && !r.rejected_at;
                  return (
                    <li
                      key={r.id}
                      className={`rounded-lg border p-3 transition-colors ${
                        needsModif
                          ? 'border-amber-400/60 bg-amber-500/5'
                          : 'border-border bg-muted/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="font-medium text-sm truncate">{r.nomfournisseur || '—'}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.entite || '—'}
                            {r.famille ? ` · ${r.famille}` : ''}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Soumise le{' '}
                            {r.created_at
                              ? format(new Date(r.created_at), 'dd/MM/yyyy à HH:mm', { locale: fr })
                              : '—'}
                          </p>

                          {/* Badges statut */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {r.rejected_at ? (
                              <Badge variant="destructive" className="gap-1 text-[10px]">
                                <XCircle className="h-3 w-3" />
                                Refusée
                              </Badge>
                            ) : needsModif ? (
                              <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-400/40 gap-1 text-[10px]">
                                <AlertCircle className="h-3 w-3" />
                                Modifications demandées
                              </Badge>
                            ) : (
                              <>
                                {r.validated_by_achats_at ? (
                                  <Badge className="bg-emerald-500/10 text-emerald-800 border-emerald-400/40 gap-1 text-[10px]">
                                    <CheckCircle2 className="h-3 w-3" />Achats ✓
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-amber-700 border-amber-400/40 gap-1 text-[10px]">
                                    <Clock className="h-3 w-3" />En attente achats
                                  </Badge>
                                )}
                                {r.validated_by_compta_at ? (
                                  <Badge className="bg-emerald-500/10 text-emerald-800 border-emerald-400/40 gap-1 text-[10px]">
                                    <CheckCircle2 className="h-3 w-3" />Compta ✓
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-amber-700 border-amber-400/40 gap-1 text-[10px]">
                                    <Clock className="h-3 w-3" />En attente compta
                                  </Badge>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        {/* Action */}
                        <Button
                          type="button"
                          size="sm"
                          variant={needsModif ? 'default' : 'outline'}
                          className={needsModif ? 'bg-amber-600 hover:bg-amber-700 text-white shrink-0 gap-1.5' : 'shrink-0'}
                          onClick={() => setDetailId(r.id)}
                        >
                          {needsModif ? (
                            <>
                              <Pencil className="h-3.5 w-3.5" />
                              Modifier
                            </>
                          ) : (
                            'Voir'
                          )}
                        </Button>
                      </div>

                      {/* Motif refus */}
                      {r.rejected_at && r.rejection_reason && (
                        <p className="mt-2 text-xs text-destructive/80 border-t border-destructive/20 pt-2">
                          Motif : {r.rejection_reason}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>

          <div className="px-6 py-3 border-t shrink-0 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Actualiser
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Drawer détail — permet l'édition si modifications_demandees */}
      <SupplierWaitingDetailDrawer
        waitingId={detailId}
        onClose={() => {
          setDetailId(null);
          refetch();
        }}
      />
    </>
  );
}
