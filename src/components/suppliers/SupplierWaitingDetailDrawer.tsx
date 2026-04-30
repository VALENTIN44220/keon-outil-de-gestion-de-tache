import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Paperclip, ExternalLink, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useSupplierWaitingApprovalDetail } from '@/hooks/useSupplierWaitingApproval';

interface Props {
  waitingId: string | null;
  onClose: () => void;
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === '') return null;
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className="text-sm break-words">{String(value)}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

export function SupplierWaitingDetailDrawer({ waitingId, onClose }: Props) {
  const { data, isLoading } = useSupplierWaitingApprovalDetail(waitingId);
  const open = !!waitingId;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[540px] p-0 flex flex-col">
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
            ) : (
              <>
                {data?.validated_by_achats_at ? (
                  <Badge className="bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30 gap-1.5">
                    <CheckCircle2 className="h-3 w-3" />
                    Achats validé
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-700 border-amber-400/50 gap-1.5">
                    <Clock className="h-3 w-3" />
                    En attente — Achats
                  </Badge>
                )}
                {data?.validated_by_compta_at ? (
                  <Badge className="bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30 gap-1.5">
                    <CheckCircle2 className="h-3 w-3" />
                    Comptabilité validé
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-700 border-amber-400/50 gap-1.5">
                    <Clock className="h-3 w-3" />
                    En attente — Comptabilité
                  </Badge>
                )}
              </>
            )}
          </div>
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

              <Section title="Identification">
                <Field label="Nom du fournisseur" value={data.nomfournisseur} />
                <Field label="Entité concernée" value={data.entite} />
                <Field label="Famille" value={data.famille} />
                <Field label="Pays" value={data.pays} />
                <Field label="N° identification (SIRET…)" value={data.siret} />
                <Field label="N° TVA / identifiant fiscal" value={data.tva} />
              </Section>

              <Separator />

              <Section title="Informations commerciales">
                <Field label="Raison / description" value={data.commentaires} />
                <Field label="Description bien / service" value={data.description} />
                <Field label="Délai de paiement" value={data.delai_de_paiement} />
                <Field label="CA annuel estimé (€)" value={data.ca_estime != null ? String(data.ca_estime) : null} />
                <Field label="TIERS" value={data.tiers} />
              </Section>

              <Separator />

              <Section title="Contact fournisseur">
                <Field label="Nom" value={data.nom_contact} />
                <Field label="Email" value={data.adresse_mail} />
                <Field label="Téléphone" value={data.telephone} />
                <Field label="Rôle" value={data.poste} />
              </Section>

              {/* Pièces jointes */}
              {data.attachments && data.attachments.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">
                      Pièces jointes
                    </h3>
                    <ul className="space-y-2">
                      {data.attachments.map((att) => (
                        <li key={att.id} className="flex items-center gap-2.5 rounded-md border bg-muted/30 px-3 py-2">
                          <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate font-medium">{att.file_name}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {att.attachment_kind === 'rib'
                                ? 'RIB'
                                : att.attachment_kind === 'justificatif_siret'
                                  ? 'Justificatif SIRET / Kbis'
                                  : att.attachment_kind}
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
                  </div>
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
