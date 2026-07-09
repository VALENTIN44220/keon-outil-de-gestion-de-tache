import { useEffect, useMemo, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Trash2, Clock, Eye, XCircle, MessageSquarePlus } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useSupplierWaitingApprovalList } from '@/hooks/useSupplierWaitingApproval';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  migrateWaitingAttachmentsToEnrichment,
  parseWaitingAttachmentsJson,
} from '@/lib/supplierWaitingPromote';
import { useSupplierValidationRole } from '@/hooks/useSupplierValidationRole';
import { useUserRole } from '@/hooks/useUserRole';
import { SupplierWaitingDetailDrawer } from './SupplierWaitingDetailDrawer';
import { SupplierWaitingRejectDialog } from './SupplierWaitingRejectDialog';
import { SupplierWaitingReviewRequestDialog } from './SupplierWaitingReviewRequestDialog';

export interface SupplierWaitingApprovalListDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SupplierWaitingApprovalListDialog({ open, onClose }: SupplierWaitingApprovalListDialogProps) {
  const queryClient = useQueryClient();
  const { data: rows = [], isLoading, refetch, isRefetching } = useSupplierWaitingApprovalList({ enabled: open });
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [validating, setValidating] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [tierSavingId, setTierSavingId] = useState<string | null>(null);

  // Détail / refus / demande modifications
  const [detailId, setDetailId] = useState<string | null>(null);
  const [rejectRow, setRejectRow] = useState<{ id: string; nomfournisseur: string | null } | null>(null);
  const [reviewRow, setReviewRow] = useState<{ id: string; nomfournisseur: string | null } | null>(null);

  // Soft delete avec raison
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectionMode(false);
      setSelectedIds(new Set());
    }
  }, [open]);

  const toggleRowSelected = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectedCount = selectedIds.size;

  const selectedRowsResolved = useMemo(() => {
    const list: NonNullable<(typeof rows)[number]>[] = [];
    for (const id of selectedIds) {
      const row = rows.find((x) => x.id === id);
      if (row) list.push(row);
    }
    return list;
  }, [selectedIds, rows]);

  const { isAdmin } = useUserRole();
  const { data: validationRole = 'none' } = useSupplierValidationRole();
  const canReject = validationRole !== 'none';

  // Peut agir côté comptabilité : compta, les deux rôles, ou admin.
  const canActCompta = validationRole === 'compta' || validationRole === 'both' || isAdmin;
  const canBoth = validationRole === 'both';

  // Toutes les lignes sélectionnées portent-elles la validation Achats (préalable) ?
  const allSelectedHaveAchats =
    selectedCount > 0 &&
    selectedRowsResolved.length === selectedCount &&
    selectedRowsResolved.every((r) => Boolean(r.validated_by_achats_at) && !r.rejected_at);

  // Numéro fournisseur (TIERS) renseigné pour toutes les lignes sélectionnées.
  const allSelectedTiersValid =
    selectedCount > 0 && selectedRowsResolved.every((r) => Boolean(r.tiers?.trim()));

  // Étape finale comptabilité : Achats validés + rôle compta → un seul bouton
  // « Valider et intégrer », activable uniquement quand le N° TIERS est valide.
  const showFinalizeStep = canActCompta && allSelectedHaveAchats;

  // Compta seul : bloqué tant que les Achats n'ont pas validé au moins une ligne.
  const comptaBlockedUntilAchat =
    validationRole === 'compta' &&
    selectedCount > 0 &&
    selectedRowsResolved.some((r) => !r.validated_by_achats_at);

  const nextStepIsAchat =
    (validationRole === 'achat' || canBoth) &&
    selectedCount > 0 &&
    selectedRowsResolved.some((r) => !r.validated_by_achats_at);

  const validationButtonLabel = showFinalizeStep
    ? selectedCount > 1
      ? 'Valider et intégrer les fournisseurs'
      : 'Valider et intégrer le fournisseur'
    : nextStepIsAchat
      ? 'Valider — étape Achats'
      : validationRole === 'achat'
        ? 'Valider (Achats)'
        : 'Valider le(s) fournisseur(s)';

  const handleSaveTiers = async (waitingId: string, raw: string) => {
    const v = raw.trim();
    setTierSavingId(waitingId);
    try {
      const { error } = await supabase
        .from('supplier_waiting_approval')
        .update({ tiers: v.length > 0 ? v : null })
        .eq('id', waitingId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['supplier-waiting-approval'] });
      await refetch();
    } catch (e: unknown) {
      const message =
        typeof e === 'object' && e !== null && 'message' in e && typeof (e as { message: unknown }).message === 'string'
          ? (e as { message: string }).message
          : 'Enregistrement du TIERS impossible';
      toast({ title: 'Erreur', description: message, variant: 'destructive' });
    } finally {
      setTierSavingId(null);
    }
  };

  const handleToggleSelectionMode = () => {
    if (selectionMode) setSelectedIds(new Set());
    setSelectionMode((v) => !v);
  };

  const handleValidateSelection = async () => {
    if (selectedCount === 0) return;
    setValidating(true);
    try {
      const { error } = await supabase.rpc('apply_supplier_waiting_validation', {
        p_waiting_ids: Array.from(selectedIds),
      });
      if (error) throw error;
      const stepLabel =
        canBoth
          ? nextStepIsAchat ? 'Achats' : 'Comptabilité'
          : validationRole === 'achat' ? 'Achats'
          : validationRole === 'compta' ? 'Comptabilité'
          : 'votre profil';
      toast({
        title: 'Validation enregistrée',
        description:
          selectedCount > 1
            ? `${selectedCount} demandes validées (étape ${stepLabel}).`
            : `La demande a été validée (étape ${stepLabel}).`,
      });
      await queryClient.invalidateQueries({ queryKey: ['supplier-waiting-approval'] });
      await refetch();
    } catch (e: unknown) {
      const message =
        typeof e === 'object' && e !== null && 'message' in e && typeof (e as { message: unknown }).message === 'string'
          ? (e as { message: string }).message
          : e instanceof Error
            ? e.message
            : 'Validation impossible';
      toast({ title: 'Erreur', description: message, variant: 'destructive' });
    } finally {
      setValidating(false);
    }
  };

  // Étape finale comptabilité en un seul clic : pose le tampon Comptabilité
  // (idempotent si déjà validé) puis intègre la/les fiche(s) au référentiel.
  const handleValidateAndIntegrate = async () => {
    if (selectedCount === 0 || !showFinalizeStep || !allSelectedTiersValid) return;
    setPromoting(true);
    try {
      // 1. Validation comptabilité (no-op si le tampon existe déjà)
      const { error: vErr } = await supabase.rpc('apply_supplier_waiting_validation', {
        p_waiting_ids: Array.from(selectedIds),
      });
      if (vErr) throw vErr;
      // 2. Intégration au référentiel
      const { data, error } = await supabase.rpc('promote_supplier_waiting_to_enrichment', {
        p_waiting_ids: Array.from(selectedIds),
      });
      if (error) throw error;
      const promoted = data ?? [];
      for (const row of promoted) {
        const atts = parseWaitingAttachmentsJson(row.attachments);
        await migrateWaitingAttachmentsToEnrichment(row.enrichment_id, atts);
      }
      toast({
        title: 'Fournisseur(s) ajouté(s) au référentiel',
        description:
          promoted.length > 1
            ? `${promoted.length} fiches ont été validées et créées dans le référentiel fournisseurs.`
            : 'La fiche a été validée et créée dans le référentiel fournisseurs.',
      });
      setSelectedIds(new Set());
      await queryClient.invalidateQueries({ queryKey: ['supplier-waiting-approval'] });
      await queryClient.invalidateQueries({ queryKey: ['supplier-enrichment'] });
      await refetch();
    } catch (e: unknown) {
      const message =
        typeof e === 'object' && e !== null && 'message' in e && typeof (e as { message: unknown }).message === 'string'
          ? (e as { message: string }).message
          : e instanceof Error
            ? e.message
            : 'Transfert impossible';
      toast({ title: 'Erreur', description: message, variant: 'destructive' });
    } finally {
      setPromoting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      // Récupère le demandeur pour notification
      const { data: row } = await supabase
        .from('supplier_waiting_approval')
        .select('submitted_by_user_id, nomfournisseur')
        .eq('id', deleteId)
        .single();

      // Soft delete
      const { error: delErr } = await supabase
        .from('supplier_waiting_approval')
        .update({
          deleted_at: new Date().toISOString(),
          deletion_reason: deleteReason.trim() || null,
          deleted_by_user_id: (await supabase.auth.getUser()).data.user?.id ?? null,
        })
        .eq('id', deleteId);
      if (delErr) throw delErr;

      // Notification in-app au demandeur si message fourni
      if (row?.submitted_by_user_id && deleteReason.trim()) {
        await supabase.from('notifications').insert({
          user_id: row.submitted_by_user_id,
          title: 'Demande fournisseur retirée',
          message: `Votre demande « ${row.nomfournisseur ?? 'fournisseur'} » a été retirée de la file d'attente. Message : ${deleteReason.trim()}`,
          type: 'supplier_deleted',
          related_entity_type: 'supplier_waiting_approval',
          related_entity_id: deleteId,
        });
      }

      toast({ title: 'Demande retirée', description: deleteReason.trim() ? 'Le demandeur a été notifié.' : undefined });
      setDeleteId(null);
      setDeleteReason('');
      setDeleteConfirmed(false);
      await queryClient.invalidateQueries({ queryKey: ['supplier-waiting-approval'] });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Suppression impossible';
      toast({ title: 'Erreur', description: message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const invalidateList = async () => {
    await queryClient.invalidateQueries({ queryKey: ['supplier-waiting-approval'] });
    await refetch();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="sm:max-w-[min(720px,92vw)] max-h-[85vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Fournisseurs en attente d&apos;approbation
            </DialogTitle>
            <DialogDescription className="text-left">
              Classés par date de soumission. L&apos;identifiant de ligne (<span className="font-mono text-xs">line_index</span>)
              regroupe une demande ; suppression définitive.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-3 flex flex-row items-center justify-between gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleToggleSelectionMode}
              disabled={rows.length === 0 && !selectionMode}
            >
              {selectionMode ? 'Annuler la sélection' : 'Sélectionner'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
              {isRefetching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Actualiser'}
            </Button>
          </div>

          <ScrollArea className="max-h-[55vh] px-6 pb-4 min-h-0">
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
                    {selectionMode && !r.rejected_at ? (
                      <div className="flex items-center pt-1 sm:pt-0">
                        <Checkbox
                          id={`waiting-select-${r.id}`}
                          checked={selectedIds.has(r.id)}
                          onCheckedChange={(c) => toggleRowSelected(r.id, c === true)}
                          aria-label={`Sélectionner ${r.nomfournisseur || 'cette demande'}`}
                        />
                      </div>
                    ) : null}

                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="font-medium truncate">{r.nomfournisseur || '—'}</div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                        <span>{r.entite || '—'}</span>
                        {r.famille ? <span>Famille&nbsp;: {r.famille}</span> : null}
                        {r.siret ? <span>N° ident. {r.siret}</span> : null}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono truncate" title={r.line_index}>
                        line_index&nbsp;: {r.line_index.slice(0, 8)}&hellip;
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Soumis le{' '}
                        {r.created_at
                          ? format(new Date(r.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })
                          : '—'}
                      </div>

                      {/* Badges statuts */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {r.rejected_at ? (
                          <Badge
                            variant="destructive"
                            className="text-[10px] font-normal gap-1"
                          >
                            <XCircle className="h-3 w-3" />
                            Refusé le {format(new Date(r.rejected_at), 'dd/MM/yyyy', { locale: fr })}
                          </Badge>
                        ) : (
                          <>
                            {r.validated_by_achats_at ? (
                              <Badge
                                variant="outline"
                                className="border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 text-[10px] font-normal"
                              >
                                Validé par les achats
                              </Badge>
                            ) : null}
                            {r.validated_by_compta_at ? (
                              <Badge
                                variant="outline"
                                className="border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 text-[10px] font-normal"
                              >
                                Validé par la comptabilité
                              </Badge>
                            ) : null}
                          </>
                        )}
                      </div>

                      {/* Motif de refus (résumé) */}
                      {r.rejected_at && r.rejection_reason && (
                        <p className="text-xs text-destructive/80 line-clamp-2 mt-0.5">
                          Motif&nbsp;: {r.rejection_reason}
                        </p>
                      )}
                    </div>

                    {/* Champ TIERS (numéro fournisseur) — saisissable dès la
                        validation Achats par la comptabilité, avant intégration. */}
                    {r.validated_by_achats_at && !r.rejected_at && canActCompta ? (
                      <div className="flex flex-col gap-1 shrink-0 sm:min-w-[140px]">
                        <Label htmlFor={`tiers-${r.id}`} className="text-xs text-muted-foreground">
                          N° fournisseur (TIERS)
                        </Label>
                        <Input
                          id={`tiers-${r.id}`}
                          key={`${r.id}-${r.tiers ?? ''}`}
                          defaultValue={r.tiers ?? ''}
                          className="h-9 font-mono text-sm"
                          disabled={tierSavingId === r.id}
                          placeholder="Ex. F12345"
                          onBlur={(e) => void handleSaveTiers(r.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                        />
                      </div>
                    ) : null}

                    {/* Actions par ligne */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Voir le détail */}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Voir le détail"
                        title="Voir le détail"
                        onClick={() => setDetailId(r.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      {/* Demander modifications */}
                      {canReject && !r.rejected_at && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-amber-600 hover:text-amber-700 border-amber-400/40 hover:border-amber-500/70"
                          aria-label="Demander des modifications"
                          title="Demander des modifications"
                          onClick={() => setReviewRow({ id: r.id, nomfournisseur: r.nomfournisseur })}
                        >
                          <MessageSquarePlus className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Refuser */}
                      {canReject && !r.rejected_at && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
                          aria-label="Refuser la demande"
                          title="Refuser"
                          onClick={() => setRejectRow({ id: r.id, nomfournisseur: r.nomfournisseur })}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Retirer (soft delete) */}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        aria-label="Retirer la demande"
                        title="Retirer la demande"
                        onClick={() => { setDeleteId(r.id); setDeleteReason(''); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>

          <div className="px-6 py-4 border-t border-border shrink-0 flex flex-col gap-2 items-stretch sm:items-end">
            {comptaBlockedUntilAchat ? (
              <p className="text-xs text-amber-800 dark:text-amber-200/90 text-right order-1 max-w-full sm:max-w-md">
                Aucune validation des achats n&apos;a encore été enregistrée pour au moins une ligne sélectionnée. Les achats
                doivent valider avant la comptabilité.
              </p>
            ) : showFinalizeStep && !allSelectedTiersValid ? (
              <p className="text-xs text-amber-800 dark:text-amber-200/90 text-right order-1 max-w-full sm:max-w-md">
                Renseignez un N° fournisseur (TIERS) pour chaque ligne sélectionnée afin de pouvoir valider et intégrer.
              </p>
            ) : null}
            <div className="flex flex-row justify-end order-2 w-full">
              <Button
                type="button"
                disabled={
                  selectedCount === 0 ||
                  validating ||
                  promoting ||
                  (tierSavingId !== null && selectedIds.has(tierSavingId)) ||
                  comptaBlockedUntilAchat ||
                  (showFinalizeStep && !allSelectedTiersValid)
                }
                className="bg-violet-600 hover:bg-violet-700 text-white shrink-0 max-w-full whitespace-normal h-auto min-h-10 py-2 text-center"
                onClick={() =>
                  void (showFinalizeStep ? handleValidateAndIntegrate() : handleValidateSelection())
                }
              >
                <span className="inline-flex items-center justify-center gap-2 text-center">
                  {(validating || promoting) && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
                  <span>{validationButtonLabel}</span>
                </span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Détail drawer */}
      <SupplierWaitingDetailDrawer
        waitingId={detailId}
        onClose={() => setDetailId(null)}
      />

      {/* Refus dialog */}
      <SupplierWaitingRejectDialog
        waitingId={rejectRow?.id ?? null}
        supplierName={rejectRow?.nomfournisseur ?? null}
        onClose={() => setRejectRow(null)}
        onRejected={async () => {
          setRejectRow(null);
          await invalidateList();
        }}
      />

      {/* Retrait soft-delete avec message au demandeur */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && !isDeleting && (setDeleteId(null), setDeleteReason(''), setDeleteConfirmed(false))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer cette demande&nbsp;?</AlertDialogTitle>
            <AlertDialogDescription>
              La demande sera masquée de la file d&apos;attente. Vous pouvez laisser un message au demandeur pour lui expliquer la raison.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="delete-reason" className="text-sm font-medium">
                Message au demandeur <span className="text-muted-foreground font-normal">(optionnel)</span>
              </Label>
              <Textarea
                id="delete-reason"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Ex : Fournisseur déjà référencé sous un autre code TIERS…"
                rows={3}
                disabled={isDeleting}
                className="resize-none"
              />
            </div>
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
              <Checkbox
                id="delete-confirm"
                checked={deleteConfirmed}
                onCheckedChange={(v) => setDeleteConfirmed(v === true)}
                disabled={isDeleting}
                className="border-destructive/60 data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
              />
              <Label htmlFor="delete-confirm" className="text-sm cursor-pointer select-none text-destructive">
                Je confirme vouloir retirer définitivement cette demande
              </Label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting || !deleteConfirmed}
              onClick={(e) => { e.preventDefault(); void handleDelete(); }}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Retirer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Demande de modifications par champ */}
      <SupplierWaitingReviewRequestDialog
        waitingId={reviewRow?.id ?? null}
        supplierName={reviewRow?.nomfournisseur ?? null}
        onClose={() => setReviewRow(null)}
        onSubmitted={async () => { setReviewRow(null); await invalidateList(); }}
      />
    </>
  );
}
