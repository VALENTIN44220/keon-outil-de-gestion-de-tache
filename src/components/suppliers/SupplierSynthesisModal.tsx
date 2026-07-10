import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  Building2,
  FileText,
  CreditCard,
  Truck,
  User,
  Globe,
  BarChart3,
  Paperclip,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSupplierById } from '@/hooks/useSupplierEnrichment';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { SupplierFinancialDashboard } from './SupplierFinancialDashboard';

interface SupplierSynthesisModalProps {
  supplierId: string | null;
  open: boolean;
  onClose: () => void;
}

function safeFormatDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'dd/MM/yyyy', { locale: fr });
}

function dateTone(iso?: string | null) {
  if (!iso) return 'none';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'none';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dd = new Date(d);
  dd.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((dd.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return 'past';
  if (diffDays <= 30) return 'soon';
  return 'future';
}

function dateColorClass(iso?: string | null) {
  const t = dateTone(iso);
  if (t === 'past') return 'text-destructive';
  if (t === 'soon') return 'text-warning';
  if (t === 'future') return 'text-success';
  return 'text-muted-foreground';
}

function formatEuro(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function dash(v: unknown): string {
  if (v === null || v === undefined) return '—';
  const s = String(v).trim();
  return s.length ? s : '—';
}

export function SupplierSynthesisModal({ supplierId, open, onClose }: SupplierSynthesisModalProps) {
  const { data: supplier, isLoading } = useSupplierById(supplierId);

  const statusConfig = {
    a_completer: { label: 'À compléter', color: 'bg-destructive/10 text-destructive' },
    en_cours: { label: 'En cours', color: 'bg-warning/10 text-warning' },
    complet: { label: 'Complet', color: 'bg-success/10 text-success' },
  } as const;

  if (!open) return null;

  const currentStatus = (supplier?.status ?? 'a_completer') as keyof typeof statusConfig;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[92vw] w-full h-[90vh] flex flex-col p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : supplier ? (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <DialogHeader className="p-5 border-b shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl flex items-center gap-2">
                      <span className="font-mono bg-muted px-2 py-0.5 rounded text-sm">{supplier.tiers}</span>
                      <span>{supplier.nomfournisseur || 'Sans nom'}</span>
                    </DialogTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={cn('text-xs', statusConfig[currentStatus]?.color)}>
                        {statusConfig[currentStatus]?.label}
                      </Badge>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Progress value={supplier.completeness_score ?? 0} className="h-1.5 w-24" />
                        <span className="text-xs">{supplier.completeness_score ?? 0}%</span>
                      </div>
                      {supplier.site_web && (
                        <a href={supplier.site_web.startsWith('http') ? supplier.site_web : `https://${supplier.site_web}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 text-xs ml-2">
                          <Globe className="h-3 w-3" /> Site web
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  Mis à jour : {safeFormatDate(supplier.updated_at)}
                </div>
              </div>
            </DialogHeader>

            {/* Contenu fiche fournisseur (hors traçabilité / validation système) */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="space-y-5">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <InfoCard icon={<Building2 className="h-4 w-4" />} label="Catégorie / Famille" value={[supplier.categorie, supplier.famille].filter(Boolean).join(' › ') || '—'} />
                  <InfoCard icon={<BarChart3 className="h-4 w-4" />} label="Segment" value={[supplier.segment, supplier.sous_segment].filter(Boolean).join(' / ') || '—'} />
                  <InfoCard icon={<FileText className="h-4 w-4" />} label="Type de contrat" value={supplier.type_de_contrat || '—'} />
                  <InfoCard icon={<Building2 className="h-4 w-4" />} label="Entité" value={supplier.entite || '—'} />
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <DateCard label="Validité prix" date={supplier.validite_prix} />
                  <DateCard label="Validité contrat" date={supplier.validite_du_contrat} />
                  <DateCard label="Première signature" date={supplier.date_premiere_signature} />
                  <InfoCard icon={<Truck className="h-4 w-4" />} label="Incoterm" value={supplier.incoterm || '—'} />
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  <InfoCard icon={<CreditCard className="h-4 w-4" />} label="Délai paiement" value={supplier.delai_de_paiement || '—'} />
                  <InfoCard icon={<CreditCard className="h-4 w-4" />} label="Remise" value={supplier.remise || '—'} />
                  <InfoCard icon={<CreditCard className="h-4 w-4" />} label="RFA" value={supplier.rfa || '—'} />
                </div>

                <SynthesisFieldSection title="Référence & fiscal" icon={<FileText className="h-4 w-4 text-primary" />}>
                  <DetailGrid>
                    <DetailCell label="Famille source initiale" value={dash(supplier.famille_source_initiale)} />
                    <DetailCell label="SIRET" value={dash(supplier.siret)} />
                    <DetailCell label="TVA" value={dash(supplier.tva)} />
                    <DetailCell label="CA estimé" value={formatEuro(supplier.ca_estime)} />
                  </DetailGrid>
                  <LongField label="Description" text={supplier.description} />
                </SynthesisFieldSection>

                <SynthesisFieldSection title="Contrat & tarifs" icon={<FileText className="h-4 w-4 text-primary" />}>
                  <DetailGrid>
                    <DetailCell label="Évolution tarif 2026" value={dash(supplier.evolution_tarif_2026)} />
                  </DetailGrid>
                  <LongField label="Avenants" text={supplier.avenants} />
                </SynthesisFieldSection>

                <SynthesisFieldSection title="Paiement & conditions" icon={<CreditCard className="h-4 w-4 text-primary" />}>
                  <DetailGrid>
                    <DetailCell label="Échéances de paiement" value={dash(supplier.echeances_de_paiement)} />
                    <DetailCell label="Exclusivité / non-sollicitation" value={dash(supplier.exclusivite_non_sollicitation)} />
                  </DetailGrid>
                  <LongField label="Commentaires délai de paiement" text={supplier.delais_de_paiement_commentaires} />
                  <LongField label="Pénalités" text={supplier.penalites} />
                </SynthesisFieldSection>

                <SynthesisFieldSection title="Logistique" icon={<Truck className="h-4 w-4 text-primary" />}>
                  <DetailGrid>
                    <DetailCell label="Transport" value={dash(supplier.transport)} />
                  </DetailGrid>
                  <LongField
                    label="Garanties bancaires & équipement"
                    text={supplier.garanties_bancaire_et_equipement != null ? String(supplier.garanties_bancaire_et_equipement) : null}
                  />
                </SynthesisFieldSection>

                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
                    <User className="h-4 w-4 text-primary" /> Contact
                  </div>
                  <DetailGrid>
                    <DetailCell label="Nom du contact" value={dash(supplier.nom_contact)} />
                    <DetailCell label="Poste" value={dash(supplier.poste)} />
                    <DetailCell label="Email" value={dash(supplier.adresse_mail)} />
                    <DetailCell label="Téléphone" value={dash(supplier.telephone)} />
                    <DetailCell label="Site web" value={dash(supplier.site_web)} className="col-span-2 lg:col-span-4" />
                  </DetailGrid>
                </Card>

                <SynthesisFieldSection title="Commentaires structurés" icon={<FileText className="h-4 w-4 text-primary" />}>
                  <DetailGrid>
                    <DetailCell label="Commentaires (contrat)" value={dash(supplier.commentaires_type_de_contrat)} />
                    <DetailCell label="Commentaires (date contrat)" value={dash(supplier.commentaires_date_contrat)} />
                  </DetailGrid>
                  <LongField label="Commentaires généraux" text={supplier.commentaires} />
                </SynthesisFieldSection>

                <SupplierAttachmentsReadOnly supplierId={supplier.id} />

                <Separator />

                <SupplierFinancialDashboard tiers={supplier.tiers} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Fournisseur introuvable
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const ATTACHMENT_KIND_LABELS: Record<string, string> = {
  rib: 'RIB',
  justificatif_siret: 'Kbis / SIRET',
  contrat: 'Contrat',
  autre: 'Autre',
};

/** Section pièces jointes en lecture seule pour la vue consultation. */
function SupplierAttachmentsReadOnly({ supplierId }: { supplierId: string }) {
  const [attachments, setAttachments] = useState<
    { id: string; file_name: string; storage_path: string; attachment_kind: string | null; created_at: string }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('supplier_attachments')
        .select('id, file_name, storage_path, attachment_kind, created_at')
        .eq('supplier_id', supplierId)
        .order('created_at', { ascending: false });
      if (!cancelled) setAttachments((data as typeof attachments) ?? []);
    })();
    return () => { cancelled = true; };
  }, [supplierId]);

  const openAttachment = async (storagePath: string) => {
    const { data } = await supabase.storage.from('supplier-attachments').createSignedUrl(storagePath, 60 * 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  return (
    <SynthesisFieldSection title="Pièces jointes" icon={<Paperclip className="h-4 w-4 text-primary" />}>
      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune pièce jointe</p>
      ) : (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div key={att.id} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <Badge variant="secondary" className="text-[10px] font-normal shrink-0">
                {ATTACHMENT_KIND_LABELS[att.attachment_kind ?? 'autre'] ?? att.attachment_kind ?? 'Autre'}
              </Badge>
              <button
                onClick={() => openAttachment(att.storage_path)}
                className="text-sm font-medium hover:underline flex items-center gap-1 text-left min-w-0"
              >
                <span className="truncate">{att.file_name}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </button>
              <span className="text-xs text-muted-foreground ml-auto shrink-0">{safeFormatDate(att.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </SynthesisFieldSection>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon} {label}
      </div>
      <div className="text-sm font-medium truncate" title={value}>{value}</div>
    </Card>
  );
}

function DateCard({ label, date }: { label: string; date?: string | null }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={cn('text-sm font-medium', dateColorClass(date))}>
        {safeFormatDate(date)}
      </div>
    </Card>
  );
}

function SynthesisFieldSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
        {icon}
        {title}
      </div>
      {children}
    </Card>
  );
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">{children}</div>;
}

function DetailCell({
  label,
  value,
  title,
  className,
}: {
  label: string;
  value: string;
  title?: string;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)} title={title}>
      <span className="text-muted-foreground text-xs block">{label}</span>
      <div className="text-sm font-medium break-words">{value}</div>
    </div>
  );
}

function LongField({ label, text }: { label: string; text?: string | null }) {
  const display = text?.trim() ? text : '—';
  return (
    <div className="mt-3 border-t border-border/60 pt-3 first:mt-0 first:border-t-0 first:pt-0">
      <span className="text-muted-foreground text-xs block mb-1">{label}</span>
      <div className="text-sm whitespace-pre-wrap break-words">{display}</div>
    </div>
  );
}
