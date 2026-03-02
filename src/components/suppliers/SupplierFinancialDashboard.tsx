import React, { useState, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, BarChart3, Filter, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MultiSearchableSelect } from '@/components/ui/multi-searchable-select';
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

const SHORT_MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Fév', '03': 'Mar', '04': 'Avr',
  '05': 'Mai', '06': 'Juin', '07': 'Juil', '08': 'Août',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Déc',
};

const YEAR_COLORS = [
  '#2563eb', '#e11d48', '#16a34a', '#d97706', '#7c3aed',
  '#0891b2', '#c026d3', '#059669',
];

const CMD_COLORS: Record<number, string> = {
  0: 'hsl(220, 70%, 50%)',
  1: 'hsl(340, 70%, 50%)',
  2: 'hsl(150, 60%, 40%)',
  3: 'hsl(35, 80%, 50%)',
  4: 'hsl(270, 60%, 50%)',
  5: 'hsl(190, 70%, 40%)',
};

const FAC_COLORS: Record<number, string> = {
  0: 'hsl(220, 50%, 70%)',
  1: 'hsl(340, 50%, 70%)',
  2: 'hsl(150, 40%, 65%)',
  3: 'hsl(35, 60%, 70%)',
  4: 'hsl(270, 40%, 70%)',
  5: 'hsl(190, 50%, 65%)',
};

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
  typeDates: string[];
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
      if (filters.typeDates.length > 0) {
        query = query.in('type_date', filters.typeDates);
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
      // Query years - filter out nulls server-side
      let yearQuery = (supabase as any).from('fou_resultat').select('annee').not('annee', 'is', null);
      if (tiers) yearQuery = yearQuery.eq('tiers', tiers);
      const { data: yearData, error: yearError } = await yearQuery.limit(5000);
      if (yearError) throw yearError;
      const years = [...new Set((yearData || []).map((r: any) => r.annee).filter(Boolean) as string[])].sort();

      // Query dos codes
      let dosQuery = (supabase as any).from('fou_resultat').select('dos');
      if (tiers) dosQuery = dosQuery.eq('tiers', tiers);
      const { data: dosData, error: dosError } = await dosQuery.limit(5000);
      if (dosError) throw dosError;
      const dosCodes = [...new Set((dosData || []).map((r: any) => String(r.dos)).filter(Boolean))].sort();

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
  const prevYear = String(new Date().getFullYear() - 1);

  const { data: distinctValues, isLoading: distinctLoading } = useDistinctValues(tiers);

  // Default: current year + previous year for comparison
  const [selectedYears, setSelectedYears] = useState<string[]>([currentYear, prevYear]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedDos, setSelectedDos] = useState<string[]>([]);
  const [selectedTypeDates, setSelectedTypeDates] = useState<string[]>([]);

  // Auto-adjust selected years when distinct values load (only keep years that exist)
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (distinctValues?.years && !initialized) {
      const available = distinctValues.years;
      const defaults = [currentYear, prevYear].filter(y => available.includes(y));
      if (defaults.length === 0 && available.length > 0) {
        // If neither current nor previous year exist, pick the latest available
        setSelectedYears([available[available.length - 1]]);
      } else {
        setSelectedYears(defaults);
      }
      setInitialized(true);
    }
  }, [distinctValues, initialized, currentYear, prevYear]);

  const { data: rawData, isLoading } = useFinancialData({
    tiers,
    years: selectedYears,
    months: selectedMonths,
    dosList: selectedDos,
    typeDates: selectedTypeDates,
  });

  // --- KPIs per year for comparison ---
  const kpisByYear = useMemo(() => {
    if (!rawData?.length) return new Map<string, { caCmd: number; caFac: number; ecart: number; nbRefs: number }>();
    const map = new Map<string, { caCmd: number; caFac: number; ecart: number; refs: Set<string> }>();
    
    rawData.forEach(r => {
      const y = r.annee || '??';
      if (!map.has(y)) map.set(y, { caCmd: 0, caFac: 0, ecart: 0, refs: new Set() });
      const entry = map.get(y)!;
      if (r.type_date === 'CMD') entry.caCmd += Number(r.ca_commande || 0);
      if (r.type_date === 'FAC') entry.caFac += Number(r.ca_facture || 0);
      entry.ecart = entry.caCmd - entry.caFac;
    });

    const result = new Map<string, { caCmd: number; caFac: number; ecart: number; nbRefs: number }>();
    map.forEach((v, k) => result.set(k, { ...v, nbRefs: v.refs.size }));
    return result;
  }, [rawData]);

  // Global KPIs (all selected years combined)
  const kpis = useMemo(() => {
    if (!rawData?.length) return { caCmd: 0, caFac: 0, ecart: 0 };
    const cmdRows = rawData.filter(r => r.type_date === 'CMD');
    const facRows = rawData.filter(r => r.type_date === 'FAC');
    const caCmd = cmdRows.reduce((s, r) => s + Number(r.ca_commande || 0), 0);
    const caFac = facRows.reduce((s, r) => s + Number(r.ca_facture || 0), 0);
    return { caCmd, caFac, ecart: caCmd - caFac };
  }, [rawData]);

  // Variation vs previous year
  const variation = useMemo(() => {
    const sortedYears = [...kpisByYear.keys()].sort();
    if (sortedYears.length < 2) return null;
    const latest = kpisByYear.get(sortedYears[sortedYears.length - 1]);
    const previous = kpisByYear.get(sortedYears[sortedYears.length - 2]);
    if (!latest || !previous || previous.caFac === 0) return null;
    return {
      latestYear: sortedYears[sortedYears.length - 1],
      previousYear: sortedYears[sortedYears.length - 2],
      pctCmd: previous.caCmd ? ((latest.caCmd - previous.caCmd) / Math.abs(previous.caCmd)) * 100 : null,
      pctFac: previous.caFac ? ((latest.caFac - previous.caFac) / Math.abs(previous.caFac)) * 100 : null,
    };
  }, [kpisByYear]);

  // --- Chart 1: Grouped bars by month (multi-year comparison) ---
  const monthlyBarData = useMemo(() => {
    if (!rawData?.length) return [];
    const map = new Map<string, Record<string, number>>();

    rawData.forEach(r => {
      const m = r.mois || '??';
      const y = r.annee || '??';
      if (!map.has(m)) map.set(m, {});
      const entry = map.get(m)!;
      if (r.type_date === 'CMD') {
        entry[`cmd_${y}`] = (entry[`cmd_${y}`] || 0) + Number(r.ca_commande || 0);
      }
      if (r.type_date === 'FAC') {
        entry[`fac_${y}`] = (entry[`fac_${y}`] || 0) + Number(r.ca_facture || 0);
      }
    });

    return Array.from(map.entries())
      .map(([month, vals]) => ({ month, label: SHORT_MONTH_LABELS[month] || month, ...vals }))
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

    const yearMonthMap = new Map<string, Map<string, number>>();
    rawData.filter(r => r.type_date === 'FAC').forEach(r => {
      const y = r.annee || '??';
      const m = r.mois || '??';
      if (!yearMonthMap.has(y)) yearMonthMap.set(y, new Map());
      const mm = yearMonthMap.get(y)!;
      mm.set(m, (mm.get(m) || 0) + Number(r.ca_facture || 0));
    });

    return allMonths.map(month => {
      const point: Record<string, any> = { month, label: SHORT_MONTH_LABELS[month] || month };
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

  // --- Filter options ---
  const yearOptions = useMemo(() =>
    (distinctValues?.years || []).map(y => ({ value: y, label: y })),
    [distinctValues]
  );

  const dosOptions = useMemo(() =>
    (distinctValues?.dosCodes || []).map((d: string) => ({ value: d, label: `${d} — ${DOS_LABELS[d] || d}` })),
    [distinctValues]
  );

  const monthOptions = Object.entries(MONTH_LABELS).map(([val, label]) => ({ value: val, label }));
  const typeDateOptions = [
    { value: 'CMD', label: 'Commandes (CMD)' },
    { value: 'FAC', label: 'Factures (FAC)' },
  ];

  if (distinctLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const customTooltipFormatter = (value: number) => formatCurrency(value);

  const sortedSelectedYears = [...selectedYears].sort();

  return (
    <div className="space-y-5">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
          <Filter className="h-4 w-4 text-primary" /> Filtres
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Année (comparer)</label>
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
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Type</label>
            <MultiSearchableSelect
              values={selectedTypeDates}
              onValuesChange={setSelectedTypeDates}
              options={typeDateOptions}
              placeholder="CMD & FAC"
              searchPlaceholder="Rechercher..."
            />
          </div>
        </div>
        {(selectedYears.length > 0 || selectedMonths.length > 0 || selectedDos.length > 0 || selectedTypeDates.length > 0) && (
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
            {selectedTypeDates.map(t => (
              <Badge key={t} variant="secondary" className="text-xs">{t === 'CMD' ? 'Commandes' : 'Factures'}</Badge>
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
          {/* KPI Cards — with year comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <KPICard
              label="CA Commandé"
              value={formatCurrency(kpis.caCmd)}
              icon={<TrendingUp className="h-4 w-4 text-primary" />}
              variation={variation?.pctCmd}
              variationLabel={variation ? `vs ${variation.previousYear}` : undefined}
            />
            <KPICard
              label="CA Facturé"
              value={formatCurrency(kpis.caFac)}
              icon={<BarChart3 className="h-4 w-4 text-success" />}
              variation={variation?.pctFac}
              variationLabel={variation ? `vs ${variation.previousYear}` : undefined}
            />
            <KPICard
              label="Écart CMD vs FAC"
              value={formatCurrency(kpis.ecart)}
              icon={<TrendingDown className="h-4 w-4 text-warning" />}
              tone={kpis.ecart > 0 ? 'warning' : kpis.ecart < 0 ? 'danger' : 'neutral'}
            />
          </div>

          {/* Per-year breakdown if multiple years selected */}
          {sortedSelectedYears.length > 1 && (
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
              {sortedSelectedYears.map((y, idx) => {
                const d = kpisByYear.get(y) || { caCmd: 0, caFac: 0, ecart: 0, nbRefs: 0 };
                return (
                  <Card key={y} className="p-3 border-l-4" style={{ borderLeftColor: YEAR_COLORS[idx % YEAR_COLORS.length] }}>
                    <div className="text-xs font-semibold mb-1">{y}</div>
                    <div className="space-y-0.5 text-xs">
                      <div className="flex justify-between"><span className="text-muted-foreground">Commandé</span><span className="font-mono font-medium">{formatCurrency(d.caCmd)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Facturé</span><span className="font-mono font-medium">{formatCurrency(d.caFac)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Écart</span><span className="font-mono font-medium">{formatCurrency(d.ecart)}</span></div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Chart 1 — Monthly grouped bars (multi-year) */}
          {monthlyBarData.length > 0 && (
            <Card className="p-4">
              <div className="text-sm font-semibold mb-3">
                CA Commandé vs Facturé par mois
                {sortedSelectedYears.length > 1 && <span className="text-muted-foreground font-normal ml-2">— Comparaison {sortedSelectedYears.join(' / ')}</span>}
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyBarData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={customTooltipFormatter} />
                    <Legend />
                    {barSeriesKeys.map((key, i) => {
                      const parts = key.split('_');
                      const type = parts[0];
                      const year = parts.slice(1).join('_');
                      const isCmd = type === 'cmd';
                      const yearIndex = sortedSelectedYears.indexOf(year);
                      return (
                        <Bar
                          key={key}
                          dataKey={key}
                          name={`${isCmd ? 'CMD' : 'FAC'} ${year}`}
                          fill={isCmd
                            ? (CMD_COLORS[yearIndex] || `hsl(210, 80%, ${55 + yearIndex * 10}%)`)
                            : (FAC_COLORS[yearIndex] || `hsl(150, 60%, ${40 + yearIndex * 10}%)`)
                          }
                          radius={[3, 3, 0, 0]}
                        />
                      );
                    })}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Chart 2 — Cumulative annual comparison */}
          {cumulativeData.length > 0 && cumulYears.length > 0 && (
            <Card className="p-4">
              <div className="text-sm font-semibold mb-3">
                Cumul CA Facturé
                {sortedSelectedYears.length > 1 && <span className="text-muted-foreground font-normal ml-2">— Comparaison annuelle</span>}
              </div>
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

function KPICard({ label, value, icon, tone, variation, variationLabel }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: 'warning' | 'danger' | 'neutral';
  variation?: number | null;
  variationLabel?: string;
}) {
  const variationColor = variation != null
    ? variation > 0 ? 'text-success' : variation < 0 ? 'text-destructive' : 'text-muted-foreground'
    : '';

  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon} {label}
      </div>
      <div className={`text-lg font-bold ${tone === 'warning' ? 'text-warning' : tone === 'danger' ? 'text-destructive' : ''}`}>
        {value}
      </div>
      {variation != null && (
        <div className={`text-xs mt-0.5 ${variationColor}`}>
          {variation > 0 ? '+' : ''}{variation.toFixed(1)}% {variationLabel}
        </div>
      )}
    </Card>
  );
}
