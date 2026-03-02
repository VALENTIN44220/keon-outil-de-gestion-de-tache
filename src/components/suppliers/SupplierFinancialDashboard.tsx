import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, BarChart3, Users, Filter } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MultiSearchableSelect } from '@/components/ui/multi-searchable-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, ResponsiveContainer, Tooltip, Legend,
} from 'recharts';

// --- Constants ---

const DOS_LABELS: Record<string, string> = {
  '100': 'KEON', '200': 'NASKEO', '300': 'SYCOMORE', '400': 'KEON.CO',
  '401': 'DOLE BIOGAZ', '402': 'CHAROLAIS BIOGAZ', '403': 'LES MARCHES DE BRETAGNE',
  '404': 'LES 3 DOMES', '405': 'BIFROST', '406': 'CERES GERMINY', '407': 'AUNIS BIOGAZ',
  '408': 'BIOGAZ DE BEL AIR', '409': 'SMB', '410': 'GATINAIS', '411': 'METHAMONDY',
  '412': 'ALLIANCE BERRY', '413': 'CAPCOO', '414': 'AKENE 17', '415': 'METHA GRAVELAIS',
  '416': 'BILLOT GAZ', '417': 'BIOMETHANE ALIERMONT', '418': 'TILLE BIOGAZ',
  '600': 'TEIKEI', '700': 'TER GREEN',
};

const MONTH_LABELS: Record<string, string> = {
  '01': 'Janvier', '02': 'Février', '03': 'Mars', '04': 'Avril',
  '05': 'Mai', '06': 'Juin', '07': 'Juillet', '08': 'Août',
  '09': 'Septembre', '10': 'Octobre', '11': 'Novembre', '12': 'Décembre',
};

const YEAR_COLORS = [
  '#4DBEC8', '#FF9432', '#78C050', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f59e0b',
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

// --- Data Hook ---

interface FouResultat {
  tiers: string;
  dos: string;
  annee: string | null;
  mois: string | null;
  type_date: string | null;
  ca_commande: number | null;
  ca_facture: number | null;
  ecart_cmd_fac: number | null;
}

function useFinancialData(filters: {
  tiers: string | null;
  years: string[];
  months: string[];
  dosList: string[];
}) {
  return useQuery({
    queryKey: ['supplier-financial-dashboard', filters],
    queryFn: async () => {
      let query = (supabase as any).from('fou_resultat').select('tiers,dos,annee,mois,type_date,ca_commande,ca_facture,ecart_cmd_fac');

      if (filters.tiers) {
        query = query.eq('tiers', filters.tiers);
      }
      if (filters.years.length > 0) {
        query = query.in('annee', filters.years);
      }
      if (filters.months.length > 0) {
        query = query.in('mois', filters.months);
      }
      if (filters.dosList.length > 0) {
        query = query.in('dos', filters.dosList);
      }

      const { data, error } = await query.order('annee').order('mois').limit(5000);
      if (error) throw error;
      return (data || []) as FouResultat[];
    },
    enabled: true,
  });
}

function useDistinctValues(tiers: string | null) {
  return useQuery({
    queryKey: ['fou-resultat-distinct', tiers],
    queryFn: async () => {
      let query = (supabase as any).from('fou_resultat').select('annee,dos');
      if (tiers) query = query.eq('tiers', tiers);
      const { data, error } = await query.limit(5000);
      if (error) throw error;
      const rows = (data || []) as { annee: string | null; dos: string }[];
      const years = [...new Set(rows.map(r => r.annee).filter(Boolean) as string[])].sort();
      const dosCodes = [...new Set(rows.map(r => r.dos).filter(Boolean))].sort();
      return { years, dosCodes };
    },
  });
}

// --- Component ---

interface SupplierFinancialDashboardProps {
  tiers: string | null;
}

export function SupplierFinancialDashboard({ tiers }: SupplierFinancialDashboardProps) {
  const currentYear = String(new Date().getFullYear());

  const { data: distinctValues, isLoading: distinctLoading } = useDistinctValues(tiers);

  const [selectedYears, setSelectedYears] = useState<string[]>([currentYear]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedDos, setSelectedDos] = useState<string[]>([]);

  const { data: rawData, isLoading } = useFinancialData({
    tiers,
    years: selectedYears,
    months: selectedMonths,
    dosList: selectedDos,
  });

  // --- KPIs ---
  const kpis = useMemo(() => {
    if (!rawData?.length) return { caCmd: 0, caFac: 0, ecart: 0, nbFournisseurs: 0 };
    const cmdRows = rawData.filter(r => r.type_date === 'CMD');
    const facRows = rawData.filter(r => r.type_date === 'FAC');
    const caCmd = cmdRows.reduce((s, r) => s + Number(r.ca_commande || 0), 0);
    const caFac = facRows.reduce((s, r) => s + Number(r.ca_facture || 0), 0);
    return {
      caCmd,
      caFac,
      ecart: caCmd - caFac,
      nbFournisseurs: new Set(rawData.map(r => r.tiers)).size,
    };
  }, [rawData]);

  // --- Chart 1: Grouped bars by month ---
  const monthlyBarData = useMemo(() => {
    if (!rawData?.length) return [];
    const map = new Map<string, Record<string, number>>();

    rawData.forEach(r => {
      const m = r.mois || '??';
      const y = r.annee || '??';
      const key = `${m}`;
      if (!map.has(key)) map.set(key, {});
      const entry = map.get(key)!;
      if (r.type_date === 'CMD') {
        entry[`cmd_${y}`] = (entry[`cmd_${y}`] || 0) + Number(r.ca_commande || 0);
      }
      if (r.type_date === 'FAC') {
        entry[`fac_${y}`] = (entry[`fac_${y}`] || 0) + Number(r.ca_facture || 0);
      }
    });

    return Array.from(map.entries())
      .map(([month, vals]) => ({ month, label: MONTH_LABELS[month] || month, ...vals }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [rawData]);

  const barSeriesKeys = useMemo(() => {
    if (!monthlyBarData.length) return [];
    const keys = new Set<string>();
    monthlyBarData.forEach(d => {
      Object.keys(d).forEach(k => {
        if (k.startsWith('cmd_') || k.startsWith('fac_')) keys.add(k);
      });
    });
    return [...keys].sort();
  }, [monthlyBarData]);

  // --- Chart 2: Cumulative annual trend ---
  const cumulativeData = useMemo(() => {
    if (!rawData?.length) return [];
    const activeYears = [...new Set(rawData.map(r => r.annee).filter(Boolean) as string[])].sort();
    const allMonths = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

    // Aggregate monthly facturé per year
    const yearMonthMap = new Map<string, Map<string, number>>();
    rawData.filter(r => r.type_date === 'FAC').forEach(r => {
      const y = r.annee || '??';
      const m = r.mois || '??';
      if (!yearMonthMap.has(y)) yearMonthMap.set(y, new Map());
      const mm = yearMonthMap.get(y)!;
      mm.set(m, (mm.get(m) || 0) + Number(r.ca_facture || 0));
    });

    return allMonths.map(month => {
      const point: Record<string, any> = { month, label: MONTH_LABELS[month] || month };
      activeYears.forEach(y => {
        const ym = yearMonthMap.get(y);
        let cumul = 0;
        for (const m of allMonths) {
          if (m > month) break;
          cumul += ym?.get(m) || 0;
        }
        point[`cumul_${y}`] = cumul;
      });
      return point;
    });
  }, [rawData]);

  const cumulYears = useMemo(() => {
    if (!cumulativeData.length) return [];
    return Object.keys(cumulativeData[0]).filter(k => k.startsWith('cumul_')).sort();
  }, [cumulativeData]);

  // --- Chart 3: Top 10 suppliers ---
  const top10Data = useMemo(() => {
    if (!rawData?.length) return [];
    const map = new Map<string, number>();
    rawData.filter(r => r.type_date === 'FAC').forEach(r => {
      map.set(r.tiers, (map.get(r.tiers) || 0) + Number(r.ca_facture || 0));
    });
    return Array.from(map.entries())
      .map(([tiers, value]) => ({ tiers, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [rawData]);

  // Enrich top10 with supplier names
  const top10Tiers = top10Data.map(d => d.tiers);
  const { data: supplierNames } = useQuery({
    queryKey: ['supplier-names-top10', top10Tiers],
    queryFn: async () => {
      if (!top10Tiers.length) return {};
      const { data } = await supabase
        .from('supplier_purchase_enrichment')
        .select('tiers,nomfournisseur')
        .in('tiers', top10Tiers);
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { map[r.tiers] = r.nomfournisseur || r.tiers; });
      return map;
    },
    enabled: top10Tiers.length > 0,
  });

  const top10Enriched = useMemo(() =>
    top10Data.map(d => ({
      ...d,
      label: supplierNames?.[d.tiers] ? `${d.tiers} — ${supplierNames[d.tiers]}` : d.tiers,
    })),
    [top10Data, supplierNames]
  );

  // --- Filter options ---
  const yearOptions = useMemo(() =>
    (distinctValues?.years || []).map(y => ({ value: y, label: y })),
    [distinctValues]
  );

  const dosOptions = useMemo(() =>
    (distinctValues?.dosCodes || []).map(d => ({ value: d, label: `${d} — ${DOS_LABELS[d] || d}` })),
    [distinctValues]
  );

  const monthOptions = Object.entries(MONTH_LABELS).map(([val, label]) => ({ value: val, label }));

  if (distinctLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const customTooltipFormatter = (value: number) => formatCurrency(value);

  return (
    <div className="space-y-5">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
          <Filter className="h-4 w-4 text-primary" /> Filtres
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Année</label>
            <MultiSearchableSelect
              values={selectedYears}
              onValuesChange={setSelectedYears}
              options={yearOptions}
              placeholder="Toutes les années"
              searchPlaceholder="Rechercher..."
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Mois</label>
            <MultiSearchableSelect
              values={selectedMonths}
              onValuesChange={setSelectedMonths}
              options={monthOptions}
              placeholder="Tous les mois"
              searchPlaceholder="Rechercher..."
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Société</label>
            <MultiSearchableSelect
              values={selectedDos}
              onValuesChange={setSelectedDos}
              options={dosOptions}
              placeholder="Toutes les sociétés"
              searchPlaceholder="Rechercher..."
            />
          </div>
        </div>
        {(selectedYears.length > 0 || selectedMonths.length > 0 || selectedDos.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {selectedYears.map(y => (
              <Badge key={y} variant="secondary" className="text-xs">{y}</Badge>
            ))}
            {selectedMonths.map(m => (
              <Badge key={m} variant="secondary" className="text-xs">{MONTH_LABELS[m]}</Badge>
            ))}
            {selectedDos.map(d => (
              <Badge key={d} variant="secondary" className="text-xs">{DOS_LABELS[d] || d}</Badge>
            ))}
          </div>
        )}
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Chargement…</span>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KPICard label="CA Commandé" value={formatCurrency(kpis.caCmd)} icon={<TrendingUp className="h-4 w-4 text-primary" />} />
            <KPICard label="CA Facturé" value={formatCurrency(kpis.caFac)} icon={<BarChart3 className="h-4 w-4 text-green-600" />} />
            <KPICard label="Écart CMD vs FAC" value={formatCurrency(kpis.ecart)} icon={<TrendingDown className="h-4 w-4 text-orange-600" />} tone={kpis.ecart > 0 ? 'warning' : kpis.ecart < 0 ? 'danger' : 'neutral'} />
            <KPICard label="Fournisseurs actifs" value={String(kpis.nbFournisseurs)} icon={<Users className="h-4 w-4 text-muted-foreground" />} />
          </div>

          {/* Chart 1 — Monthly grouped bars */}
          {monthlyBarData.length > 0 && (
            <Card className="p-4">
              <div className="text-sm font-semibold mb-3">CA Commandé vs Facturé par mois</div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyBarData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={customTooltipFormatter} />
                    <Legend />
                    {barSeriesKeys.map((key, i) => {
                      const [type, year] = key.split('_');
                      const isCmd = type === 'cmd';
                      return (
                        <Bar
                          key={key}
                          dataKey={key}
                          name={`${isCmd ? 'Commandé' : 'Facturé'} ${year}`}
                          fill={isCmd ? `hsl(210, 80%, ${55 + i * 5}%)` : `hsl(150, 60%, ${40 + i * 5}%)`}
                          radius={[3, 3, 0, 0]}
                        />
                      );
                    })}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Chart 2 — Cumulative annual */}
          {cumulativeData.length > 0 && cumulYears.length > 0 && (
            <Card className="p-4">
              <div className="text-sm font-semibold mb-3">Cumul CA Facturé par année</div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cumulativeData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={customTooltipFormatter} />
                    <Legend />
                    {cumulYears.map((key, i) => (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        name={`Cumul ${key.replace('cumul_', '')}`}
                        stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Chart 3 — Top 10 suppliers */}
          {top10Enriched.length > 0 && (
            <Card className="p-4">
              <div className="text-sm font-semibold mb-3">Top 10 Fournisseurs — CA Facturé</div>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top10Enriched} layout="vertical" margin={{ top: 5, right: 20, left: 150, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={140} />
                    <Tooltip formatter={customTooltipFormatter} />
                    <Bar dataKey="value" name="CA Facturé" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {!rawData?.length && (
            <Card className="p-8 text-center text-muted-foreground">
              <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <div className="text-sm">Aucune donnée financière pour les filtres sélectionnés</div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function KPICard({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone?: 'warning' | 'danger' | 'neutral' }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon} {label}
      </div>
      <div className={`text-lg font-bold ${tone === 'warning' ? 'text-orange-600' : tone === 'danger' ? 'text-red-600' : ''}`}>
        {value}
      </div>
    </Card>
  );
}
