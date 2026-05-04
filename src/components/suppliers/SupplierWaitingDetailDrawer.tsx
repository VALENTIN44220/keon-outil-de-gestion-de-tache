import { useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Paperclip, ExternalLink, CheckCircle2, Clock, XCircle, AlertCircle, Pencil, Send, UploadCloud, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useSupplierWaitingApprovalDetail, SupplierWaitingFieldReview, SupplierWaitingAttachment } from '@/hooks/useSupplierWaitingApproval';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { SupplierWaitingReviewRequestDialog } from './SupplierWaitingReviewRequestDialog';
import { supplierWaitingValidationRoleFromProfileName, extractPermissionProfileName } from '@/lib/supplierWaitingValidationRole';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { isAllowedDemandAttachmentFile } from '@/lib/newSupplierDemandConstants';

interface Props {
  waitingId: string | null;
  onClose: () => void;
}

// Mapping field_key → label lisible
const FIELD_LABELS: Record<string, string> = {
  nomfournisseur:   'Nom du fournisseur',
  entite:           'Entité concernée',
  famille:          'Famille fournisseur',
  pays:             'Pays',
  siret:            'N° identification (SIRET…)',
  tva:              'N° TVA / identifiant fiscal',
  commentaires:     'Raison / description',
  description:      'Description du bien / service',
  delai_de_paiement:'Délai de paiement',
  ca_estime:        'CA annuel estimé (€)',
  nom_contact:      'Nom du contact',
  adresse_mail:     'Email du contact',
  telephone:        'Téléphone',
  poste:            'Rôle / poste du contact',
};

type EditableField = keyof typeof FIELD_LABELS;

function ReviewBadge({ review }: { review: SupplierWaitingFieldReview }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-400/50 bg-amber-500/10 px-3 py-2 mt-1">
      <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800 dark:text-amber-200">{review.comment}</p>
    </div>
  );
}

function EditableField({
  fieldKey,
  label,
  value,
  review,
  editing,
  editValue,
  onEditChange,
  multiline,
}: {
  fieldKey: string;
  label: string;
  value: string | number | null | undefined;
  review?: SupplierWaitingFieldReview;
  editing: boolean;
  editValue: string;
  onEditChange: (v: string) => void;
  multiline?: boolean;
}) {
  if (!editing && (value == null || value === '') && !review) return null;

  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1.5">
        {label}
        {review && <span className="normal-case font-normal text-amber-600 text-[10px]">— modification demandée</span>}
      </p>
      {editing ? (
        multiline ? (
          <Textarea
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            rows={3}
            className="resize-none text-sm"
          />
        ) : (
          <Input
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            className="h-8 text-sm"
          />
        )
      ) : (
        <p className={`text-sm break-words ${review ? 'text-amber-900 dark:text-amber-100' : ''}`}>
          {value != null && value !== '' ? String(value) : <span className="text-muted-foreground italic">Non renseigné</span>}
        </p>
      )}
      {review && <ReviewBadge review={review} />}
    </div>
  );
}

export function SupplierWaitingDetailDrawer({ waitingId, onClose }: Props) {
  const { data, isLoading, refetch } = useSupplierWaitingApprovalDetail(waitingId);
  const queryClient = useQueryClient();
  const { profile: authProfile } = useAuth();
  const { getActiveProfile } = useSimulation();
  const profile = getActiveProfile() ?? authProfile;
  const open = !!waitingId;

  const [editMode, setEditMode] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);

  // Pièces jointes en mode édition
  type AttachmentKind = 'rib' | 'justificatif_siret';
  const [newFiles, setNewFiles] = useState<Partial<Record<AttachmentKind, File>>>({});
  const ribInputRef = useRef<HTMLInputElement>(null);
  const kbisInputRef = useRef<HTMLInputElement>(null);

  const { isAdmin } = useUserRole();
  const permissionProfileName = extractPermissionProfileName(profile);
  const validationRole = supplierWaitingValidationRoleFromProfileName(permissionProfileName);
  const canReview = isAdmin || validationRole === 'achat' || validationRole === 'compta' || validationRole === 'hybrid';

  const hasModificationsRequested = data?.status === 'modifications_demandees';
  const reviewsByField = Object.fromEntries(
    (data?.field_reviews ?? []).map((r) => [r.field_key, r]),
  );

  const setField = (key: string, val: string) =>
    setEditValues((prev) => ({ ...prev, [key]: val }));

  const getEditVal = (key: EditableField) =>
    editValues[key] ?? String(data?.[key] ?? '');

  const startEdit = () => {
    const init: Record<string, string> = {};
    (Object.keys(FIELD_LABELS) as EditableField[]).forEach((k) => {
      init[k] = String(data?.[k] ?? '');
    });
    setEditValues(init);
    setNewFiles({});
    setEditMode(true);
  };

  const handleFileChange = (kind: AttachmentKind, file: File | null) => {
    if (!file) return;
    if (!isAllowedDemandAttachmentFile(file)) {
      toast({ title: 'Format non autorisé', description: 'PDF, JPG, PNG ou DOCX uniquement.', variant: 'destructive' });
      return;
    }
    setNewFiles((prev) => ({ ...prev, [kind]: file }));
  };

  /** Remplace (ou ajoute) une pièce jointe d'un type donné pour cette demande. */
  const replaceAttachment = async (waitingId: string, file: File, kind: AttachmentKind, existingAtt?: SupplierWaitingAttachment) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Non connecté');

    const ext = file.name.split('.').pop() ?? 'bin';
    const storagePath = `${waitingId}/${kind}.${ext}`;

    // Supprimer l'ancien fichier storage si existant
    if (existingAtt?.storage_path) {
      await supabase.storage.from('supplier-waiting-attachments').remove([existingAtt.storage_path]);
    }

    // Upload du nouveau fichier (upsert)
    const { error: upErr } = await supabase.storage
      .from('supplier-waiting-attachments')
      .upload(storagePath, file, { upsert: true });
    if (upErr) throw upErr;

    const { data: signed } = await supabase.storage
      .from('supplier-waiting-attachments')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);
    const fileUrl = signed?.signedUrl ?? '';

    if (existingAtt) {
      // Mettre à jour la ligne existante
      const { error } = await supabase
        .from('supplier_waiting_approval_attachments')
        .update({ file_name: file.name, file_url: fileUrl, storage_path: storagePath })
        .eq('id', existingAtt.id);
      if (error) throw error;
    } else {
      // Insérer une nouvelle ligne
      const { error } = await supabase
        .from('supplier_waiting_approval_attachments')
        .insert({
          waiting_approval_id: waitingId,
          attachment_kind: kind,
          file_name: file.name,
          file_url: fileUrl,
          storage_path: storagePath,
          uploaded_by: userData.user.id,
        });
      if (error) throw error;
    }
  };

  const handleResubmit = async () => {
    if (!waitingId || !data) return;
    setSubmitting(true);
    try {
      // Mise à jour des champs texte
      const updates: Record<string, unknown> = { status: 'a_completer' };
      (Object.keys(FIELD_LABELS) as EditableField[]).forEach((k) => {
        if (editValues[k] !== undefined) {
          updates[k] = editValues[k].trim() || null;
        }
      });
      if (updates.ca_estime) {
        const n = Number(String(updates.ca_estime).replace(',', '.'));
        updates.ca_estime = isFinite(n) ? n : null;
      }

      const { error: updErr } = await supabase
        .from('supplier_waiting_approval')
        .update(updates)
        .eq('id', waitingId);
      if (updErr) throw updErr;

      // Remplacer les pièces jointes modifiées
      const attachmentKinds: AttachmentKind[] = ['rib', 'justificatif_siret'];
      for (const kind of attachmentKinds) {
        const file = newFiles[kind];
        if (!file) continue;
        const existing = data.attachments?.find((a) => a.attachment_kind === kind);
        await replaceAttachment(waitingId, file, kind, existing);
      }

      // Marquer toutes les revues comme résolues
      await supabase
        .from('supplier_waiting_field_reviews')
        .update({ resolved_at: new Date().toISOString(), resolved_by: (await supabase.auth.getUser()).data.user?.id ?? null })
        .eq('waiting_id', waitingId)
        .is('resolved_at', null);

      toast({ title: 'Demande mise à jour', description: 'Votre demande a été soumise à nouveau aux validateurs.' });
      setEditMode(false);
      setNewFiles({});
      await queryClient.invalidateQueries({ queryKey: ['supplier-waiting-approval'] });
      await queryClient.invalidateQueries({ queryKey: ['supplier-waiting-approval-detail', waitingId] });
      await queryClient.invalidateQueries({ queryKey: ['my-supplier-requests'] });
      refetch();
    } catch (e: unknown) {
      toast({ title: 'Erreur', description: e instanceof Error ? e.message : 'Mise à jour impossible', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { if (!o) { setEditMode(false); onClose(); } }}>
        <SheetContent side="right" className="w-full sm:max-w-[560px] p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <SheetTitle className="text-base">
              {data?.nomfournisseur ?? 'Détail de la demande'}
            </SheetTitle>
            <SheetDescription className="text-left text-xs">
              Demande soumise le{' '}
              {data?.created_at
                ? format(new Date(data.created_at), 'dd/MM/yyyy à HH:mm', { locale: fr })
                : '—'}
            </SheetDescription>

            {/* Statuts */}
            <div className="flex flex-wrap gap-2 pt-1">
              {data?.rejected_at ? (
                <Badge variant="destructive" className="gap-1.5">
                  <XCircle className="h-3 w-3" />
                  Refusé le {format(new Date(data.rejected_at), 'dd/MM/yyyy', { locale: fr })}
                </Badge>
              ) : hasModificationsRequested ? (
                <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30 gap-1.5">
                  <AlertCircle className="h-3 w-3" />
                  Modifications demandées ({data?.field_reviews?.length ?? 0} champ{(data?.field_reviews?.length ?? 0) > 1 ? 's' : ''})
                </Badge>
              ) : (
                <>
                  {data?.validated_by_achats_at ? (
                    <Badge className="bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30 gap-1.5">
                      <CheckCircle2 className="h-3 w-3" />Achats validé
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-700 border-amber-400/50 gap-1.5">
                      <Clock className="h-3 w-3" />En attente — Achats
                    </Badge>
                  )}
                  {data?.validated_by_compta_at ? (
                    <Badge className="bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30 gap-1.5">
                      <CheckCircle2 className="h-3 w-3" />Comptabilité validé
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-700 border-amber-400/50 gap-1.5">
                      <Clock className="h-3 w-3" />En attente — Comptabilité
                    </Badge>
                  )}
                </>
              )}
            </div>

            {/* Actions header */}
            {!isLoading && data && !data.rejected_at && (
              <div className="flex gap-2 pt-1">
                {hasModificationsRequested && !editMode && (
                  <Button size="sm" variant="outline" onClick={startEdit} className="gap-1.5 border-amber-400/50 text-amber-700 hover:text-amber-800">
                    <Pencil className="h-3.5 w-3.5" />
                    Modifier ma demande
                  </Button>
                )}
                {canReview && !hasModificationsRequested && (
                  <Button size="sm" variant="outline" onClick={() => setShowReviewDialog(true)} className="gap-1.5 border-amber-400/50 text-amber-700 hover:text-amber-800">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Demander modifications
                  </Button>
                )}
              </div>
            )}
          </SheetHeader>

          <ScrollArea className="flex-1 min-h-0">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              </div>
            ) : !data ? (
              <p className="text-sm text-muted-foreground text-center py-12">Données introuvables.</p>
            ) : (
              <div className="px-6 py-5 space-y-6">
                {/* Refus */}
                {data.rejected_at && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-1.5">
                    <p className="text-sm font-semibold text-destructive">Motif de refus</p>
                    <p className="text-sm">{data.rejection_reason ?? '—'}</p>
                  </div>
                )}

                {/* Bandeau modifications demandées */}
                {hasModificationsRequested && !editMode && (
                  <div className="rounded-lg border border-amber-400/50 bg-amber-500/10 p-4">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
                      Des modifications sont requises
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Consultez les commentaires sur les champs ci-dessous, puis cliquez sur « Modifier ma demande ».
                    </p>
                  </div>
                )}

                {/* Identification */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">Identification</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(['nomfournisseur','entite','famille','pays','siret','tva'] as EditableField[]).map((k) => (
                      <EditableField
                        key={k}
                        fieldKey={k}
                        label={FIELD_LABELS[k]}
                        value={data[k]}
                        review={reviewsByField[k]}
                        editing={editMode}
                        editValue={getEditVal(k)}
                        onEditChange={(v) => setField(k, v)}
                      />
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Informations commerciales */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">Informations commerciales</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(['commentaires','description','delai_de_paiement','ca_estime'] as EditableField[]).map((k) => (
                      <EditableField
                        key={k}
                        fieldKey={k}
                        label={FIELD_LABELS[k]}
                        value={data[k]}
                        review={reviewsByField[k]}
                        editing={editMode}
                        editValue={getEditVal(k)}
                        onEditChange={(v) => setField(k, v)}
                        multiline={k === 'commentaires' || k === 'description'}
                      />
                    ))}
                    {!editMode && <div className="space-y-0.5"><p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">TIERS</p><p className="text-sm">{data.tiers ?? <span className="italic text-muted-foreground">Non renseigné</span>}</p></div>}
                  </div>
                </div>

                <Separator />

                {/* Contact */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">Contact fournisseur</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(['nom_contact','adresse_mail','telephone','poste'] as EditableField[]).map((k) => (
                      <EditableField
                        key={k}
                        fieldKey={k}
                        label={FIELD_LABELS[k]}
                        value={data[k]}
                        review={reviewsByField[k]}
                        editing={editMode}
                        editValue={getEditVal(k)}
                        onEditChange={(v) => setField(k, v)}
                      />
                    ))}
                  </div>
                </div>

                {/* Pièces jointes */}
                {(editMode || (data.attachments && data.attachments.length > 0)) && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">
                        Pièces jointes
                      </h3>

                      {editMode ? (
                        // Mode édition : affichage + remplacement de chaque pièce
                        <div className="space-y-3">
                          {(['rib', 'justificatif_siret'] as AttachmentKind[]).map((kind) => {
                            const existing = data.attachments?.find((a) => a.attachment_kind === kind);
                            const pending = newFiles[kind];
                            const kindLabel = kind === 'rib' ? 'RIB' : 'Justificatif SIRET / Kbis';
                            const inputRef = kind === 'rib' ? ribInputRef : kbisInputRef;
                            return (
                              <div key={kind} className="rounded-md border bg-muted/20 px-3 py-2.5 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-muted-foreground uppercase">{kindLabel}</p>
                                      {pending ? (
                                        <p className="text-sm truncate text-primary font-medium">{pending.name} <span className="text-xs text-muted-foreground">(nouveau)</span></p>
                                      ) : existing ? (
                                        <p className="text-sm truncate">{existing.file_name}</p>
                                      ) : (
                                        <p className="text-sm text-muted-foreground italic">Aucun fichier</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {existing?.file_url && !pending && (
                                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                        <a href={existing.file_url} target="_blank" rel="noopener noreferrer" title="Ouvrir">
                                          <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                      </Button>
                                    )}
                                    {pending && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                        title="Annuler le remplacement"
                                        onClick={() => setNewFiles((p) => { const n = { ...p }; delete n[kind]; return n; })}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs gap-1"
                                      onClick={() => inputRef.current?.click()}
                                    >
                                      <UploadCloud className="h-3 w-3" />
                                      {existing || pending ? 'Remplacer' : 'Ajouter'}
                                    </Button>
                                    <input
                                      ref={inputRef}
                                      type="file"
                                      className="hidden"
                                      accept=".pdf,.jpg,.jpeg,.png,.docx"
                                      onChange={(e) => handleFileChange(kind, e.target.files?.[0] ?? null)}
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        // Mode lecture seule
                        <ul className="space-y-2">
                          {data.attachments!.map((att) => (
                            <li key={att.id} className="flex items-center gap-2.5 rounded-md border bg-muted/30 px-3 py-2">
                              <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate font-medium">{att.file_name}</p>
                                <p className="text-xs text-muted-foreground capitalize">
                                  {att.attachment_kind === 'rib' ? 'RIB' : att.attachment_kind === 'justificatif_siret' ? 'Justificatif SIRET / Kbis' : att.attachment_kind}
                                </p>
                              </div>
                              {att.file_url && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" asChild>
                                  <a href={att.file_url} target="_blank" rel="noopener noreferrer" title="Ouvrir">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                </Button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Footer mode édition */}
          {editMode && (
            <div className="px-6 py-4 border-t shrink-0 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditMode(false)} disabled={submitting}>
                Annuler
              </Button>
              <Button
                onClick={() => void handleResubmit()}
                disabled={submitting}
                className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Soumettre les modifications
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog demande modifications depuis le drawer (pour les validateurs) */}
      <SupplierWaitingReviewRequestDialog
        waitingId={showReviewDialog ? waitingId : null}
        supplierName={data?.nomfournisseur ?? null}
        onClose={() => setShowReviewDialog(false)}
        onSubmitted={async () => {
          setShowReviewDialog(false);
          await queryClient.invalidateQueries({ queryKey: ['supplier-waiting-approval'] });
          await queryClient.invalidateQueries({ queryKey: ['supplier-waiting-approval-detail', waitingId] });
          refetch();
        }}
      />
    </>
  );
}
