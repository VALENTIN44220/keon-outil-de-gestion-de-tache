import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Loader2, Building2, FileText, CreditCard, Truck, User, Globe, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { useSupplierById } from '@/hooks/useSupplierEnrichment';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts';

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
  if (t === 'past') return 'text-red-600';
  if (t === 'soon') return 'text-orange-600';
  if (t === 'future') return 'text-green-700';
  return 'text-muted-foreground';
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 200 80% 50%))',
  'hsl(var(--chart-3, 150 60% 45%))',
  'hsl(var(--chart-4, 40 90% 55%))',
  'hsl(var(--chart-5, 0 70% 55%))',
];

function useSupplierFinancials(tiers: string | null) {
  return useQuery({
    queryKey: ['fou_resultat', tiers],
    queryFn: async () => {
      if (!tiers) return null;
      const { data, error } = await (supabase as any)
        .from('fou_resultat')
        .select('*')
        .eq('tiers', tiers)
        .order('annee_fac', { ascending: true })
        .order('mois_fac', { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!tiers,
  });
}

export function SupplierSynthesisModal({ supplierId, open, onClose }: SupplierSynthesisModalProps) {
  const { data: supplier, isLoading } = useSupplierById(supplierId);
  const { data: financials, isLoading: finLoading } = useSupplierFinancials(supplier?.tiers ?? null);

  const statusConfig = {
    a_completer: { label: 'À compléter', color: 'bg-destructive/10 text-destructive' },
    en_cours: { label: 'En cours', color: 'bg-warning/10 text-warning' },
    complet: { label: 'Complet', color: 'bg-success/10 text-success' },
  } as const;

  // Aggregate financials by year
  const yearlyData = useMemo(() => {
    if (!financials?.length) return [];
    const map = new Map<string, { ca_commande: number; ca_facture: number; ecart: number }>();
    financials.forEach((r: any) => {
      const year = r.annee_fac || r.annee_cmd || 'N/A';
      const existing = map.get(year) || { ca_commande: 0, ca_facture: 0, ecart: 0 };
      existing.ca_commande += Number(r.ca_commande || 0);
      existing.ca_facture += Number(r.ca_facture || 0);
      existing.ecart += Number(r.ecart_cmd_fac || 0);
      map.set(year, existing);
    });
    return Array.from(map.entries())
      .map(([year, v]) => ({ year, ...v }))
      .sort((a, b) => a.year.localeCompare(b.year));
  }, [financials]);

  // Monthly trend for most recent year
  const monthlyData = useMemo(() => {
    if (!financials?.length) return [];
    const years = [...new Set(financials.map((r: any) => r.annee_fac).filter(Boolean))].sort();
    const latestYear = years[years.length - 1];
    if (!latestYear) return [];
    const map = new Map<string, { ca_commande: number; ca_facture: number }>();
    financials.filter((r: any) => r.annee_fac === latestYear).forEach((r: any) => {
      const month = r.mois_fac || '01';
      const existing = map.get(month) || { ca_commande: 0, ca_facture: 0 };
      existing.ca_commande += Number(r.ca_commande || 0);
      existing.ca_facture += Number(r.ca_facture || 0);
      map.set(month, existing);
    });
    return Array.from(map.entries())
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [financials]);

  // By entity (dos)
  const byEntityData = useMemo(() => {
    if (!financials?.length) return [];
    const map = new Map<string, number>();
    financials.forEach((r: any) => {
      const dos = r.dos || 'N/A';
      map.set(dos, (map.get(dos) || 0) + Number(r.ca_facture || 0));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [financials]);

  // KPI totals
  const totals = useMemo(() => {
    if (!financials?.length) return { ca_commande: 0, ca_facture: 0, ecart: 0, nb_refs: 0 };
    const refs = new Set(financials.map((r: any) => r.ref));
    return {
      ca_commande: financials.reduce((s: number, r: any) => s + Number(r.ca_commande || 0), 0),
      ca_facture: financials.reduce((s: number, r: any) => s + Number(r.ca_facture || 0), 0),
      ecart: financials.reduce((s: number, r: any) => s + Number(r.ecart_cmd_fac || 0), 0),
      nb_refs: refs.size,
    };
  }, [financials]);

  const formatCurrency = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

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

                {/* Financial KPIs */}
                {finLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-2 text-sm text-muted-foreground">Chargement des données financières…</span>
                  </div>
                ) : financials && financials.length > 0 ? (
                  <>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <TrendingUp className="h-4 w-4 text-primary" /> Données financières
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <KPICard label="CA Commandé" value={formatCurrency(totals.ca_commande)} icon={<TrendingUp className="h-4 w-4 text-primary" />} />
                      <KPICard label="CA Facturé" value={formatCurrency(totals.ca_facture)} icon={<BarChart3 className="h-4 w-4 text-green-600" />} />
                      <KPICard label="Encours (écart)" value={formatCurrency(totals.ecart)} icon={<TrendingDown className="h-4 w-4 text-orange-600" />} />
                      <KPICard label="Réf. articles" value={String(totals.nb_refs)} icon={<FileText className="h-4 w-4 text-muted-foreground" />} />
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Yearly bar chart */}
                      {yearlyData.length > 0 && (
                        <Card className="p-4">
                          <div className="text-sm font-semibold mb-3">CA par année</div>
                          <div className="h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={yearlyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Bar dataKey="ca_commande" name="Commandé" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="ca_facture" name="Facturé" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </Card>
                      )}

                      {/* Monthly line chart */}
                      {monthlyData.length > 0 && (
                        <Card className="p-4">
                          <div className="text-sm font-semibold mb-3">Tendance mensuelle ({yearlyData[yearlyData.length - 1]?.year})</div>
                          <div className="h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Line type="monotone" dataKey="ca_commande" name="Commandé" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                                <Line type="monotone" dataKey="ca_facture" name="Facturé" stroke="hsl(var(--success))" strokeWidth={2} dot={{ r: 3 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </Card>
                      )}
                    </div>

                    {/* By entity pie */}
                    {byEntityData.length > 0 && (
                      <Card className="p-4">
                        <div className="text-sm font-semibold mb-3">Répartition par entité (société)</div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={byEntityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}>
                                  {byEntityData.map((_, i) => (
                                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                  ))}
                                </Pie>
                                <ChartTooltip content={<ChartTooltipContent />} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="space-y-2">
                            {byEntityData.map((item, i) => (
                              <div key={item.name} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                                  <span>{item.name}</span>
                                </div>
                                <span className="font-medium font-mono">{formatCurrency(item.value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Card>
                    )}
                  </>
                ) : (
                  <Card className="p-6 text-center text-muted-foreground">
                    <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <div className="text-sm">Aucune donnée financière disponible pour ce fournisseur</div>
                  </Card>
                )}
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

function KPICard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon} {label}
      </div>
      <div className="text-lg font-bold">{value}</div>
    </Card>
  );
}
