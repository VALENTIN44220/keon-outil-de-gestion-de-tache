import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Loader2, Building2, FileText, CreditCard, Truck, User, Globe, BarChart3 } from 'lucide-react';
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

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="space-y-5">

                {/* Info Cards Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <InfoCard icon={<Building2 className="h-4 w-4" />} label="Catégorie / Famille" value={[supplier.categorie, supplier.famille].filter(Boolean).join(' › ') || '—'} />
                  <InfoCard icon={<BarChart3 className="h-4 w-4" />} label="Segment" value={[supplier.segment, supplier.sous_segment].filter(Boolean).join(' / ') || '—'} />
                  <InfoCard icon={<FileText className="h-4 w-4" />} label="Type de contrat" value={supplier.type_de_contrat || '—'} />
                  <InfoCard icon={<Building2 className="h-4 w-4" />} label="Entité" value={supplier.entite || '—'} />
                </div>

                {/* Dates Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <DateCard label="Validité prix" date={supplier.validite_prix} />
                  <DateCard label="Validité contrat" date={supplier.validite_du_contrat} />
                  <DateCard label="Première signature" date={supplier.date_premiere_signature} />
                  <InfoCard icon={<Truck className="h-4 w-4" />} label="Incoterm" value={supplier.incoterm || '—'} />
                </div>

                {/* Contract details */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  <InfoCard icon={<CreditCard className="h-4 w-4" />} label="Délai paiement" value={supplier.delai_de_paiement || '—'} />
                  <InfoCard icon={<CreditCard className="h-4 w-4" />} label="Remise" value={supplier.remise || '—'} />
                  <InfoCard icon={<CreditCard className="h-4 w-4" />} label="RFA" value={supplier.rfa || '—'} />
                </div>

                {/* Contact */}
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
                    <User className="h-4 w-4 text-primary" /> Contact
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                    <div><span className="text-muted-foreground text-xs">Nom</span><div className="font-medium">{supplier.nom_contact || '—'}</div></div>
                    <div><span className="text-muted-foreground text-xs">Poste</span><div>{supplier.poste || '—'}</div></div>
                    <div><span className="text-muted-foreground text-xs">Email</span><div>{supplier.adresse_mail || '—'}</div></div>
                    <div><span className="text-muted-foreground text-xs">Tél.</span><div>{supplier.telephone || '—'}</div></div>
                  </div>
                </Card>

                {/* Comments */}
                {(supplier.commentaires || supplier.avenants || supplier.evolution_tarif_2026) && (
                  <Card className="p-4">
                    <div className="text-sm font-semibold mb-2">Notes & Commentaires</div>
                    <div className="space-y-2 text-sm">
                      {supplier.commentaires && <div><span className="text-muted-foreground text-xs">Commentaires :</span><div className="whitespace-pre-wrap">{supplier.commentaires}</div></div>}
                      {supplier.avenants && <div><span className="text-muted-foreground text-xs">Avenants :</span><div className="whitespace-pre-wrap">{supplier.avenants}</div></div>}
                      {supplier.evolution_tarif_2026 && <div><span className="text-muted-foreground text-xs">Évolution tarif 2026 :</span><div className="whitespace-pre-wrap">{supplier.evolution_tarif_2026}</div></div>}
                    </div>
                  </Card>
                )}

                <Separator />

                {/* Financial Dashboard */}
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
