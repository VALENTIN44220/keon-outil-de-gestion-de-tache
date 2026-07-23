/**
 * ITBudgetYearCompare — comparatif pluriannuel du budget IT.
 *
 * Vue GLOBALE : par exercice, Budget initial (BUD), Reforecast (F), coût RH,
 * engagé et constaté (Divalto) + graphe barres.
 * Vue PIVOT : un axe (Catégorie / Type / Entité / Projet) en lignes × années en
 * colonnes, pour une métrique (Budget ou Reforecast).
 * Export Excel de la vue affichée.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { GitCompareArrows, Download } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts';
import { lineAnnualBudget, lineAnnualBudgetRevise } from '@/lib/itBudgetTotals';
import { useITProjects } from '@/hooks/useITProjects';

const eur = (n: number) =>
  (Number(n) || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eurK = (n: number) => `${Math.round((Number(n) || 0) / 1000)} k€`;

type Axis = 'global' | 'categorie' | 'type_depense' | 'entite' | 'projet';
type Metric = 'bud' | 'reforecast';

const AXIS_LABEL: Record<Axis, string> = {
  global: 'Vue globale', categorie: 'Catégorie', type_depense: 'Type de dépense', entite: 'Entité', projet: 'Projet',
};
const METRIC_LABEL: Record<Metric, string> = { bud: 'Budget (BUD)', reforecast: 'Reforecast (F)' };

interface YearRow {
  annee: number;
  bud: number;
  reforecast: number;
  rh: number;
  engage: number;
  constate: number;
}

export function ITBudgetYearCompare() {
  const [axis, setAxis] = useState<Axis>('global');
  const [metric, setMetric] = useState<Metric>('bud');

  const { projects = [] } = useITProjects();
  const projName = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects as any[]) m.set(p.id, p.code_projet_digital || p.nom_projet || p.id.slice(0, 8));
    return m;
  }, [projects]);

  const linesQ = useQuery({
    queryKey: ['it-budget-compare-lines'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('it_budget_lines')
        .select('annee, budget_type, montant_budget, montant_budget_revise, montant_annuel, mois_budget, budget_type_revise, mois_budget_revise, categorie, type_depense, entite, it_project_id');
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const rhQ = useQuery({
    queryKey: ['it-budget-compare-rh'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('v_it_rh_cout').select('annee, cout_charge_annuel');
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const ecQ = useQuery({
    queryKey: ['it-budget-compare-engage-constate'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('v_it_budget_engage_constate').select('annee, engage, constate');
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const isLoading = linesQ.isLoading || rhQ.isLoading || ecQ.isLoading;

  // ── Vue globale : agrégat par année ──
  const rows: YearRow[] = useMemo(() => {
    const byYear = new Map<number, YearRow>();
    const get = (annee: number) => {
      let r = byYear.get(annee);
      if (!r) { r = { annee, bud: 0, reforecast: 0, rh: 0, engage: 0, constate: 0 }; byYear.set(annee, r); }
      return r;
    };
    for (const l of linesQ.data ?? []) {
      const y = Number(l.annee); if (!y) continue;
      const r = get(y); r.bud += lineAnnualBudget(l); r.reforecast += lineAnnualBudgetRevise(l);
    }
    for (const l of rhQ.data ?? []) { const y = Number(l.annee); if (y) get(y).rh += Number(l.cout_charge_annuel) || 0; }
    for (const l of ecQ.data ?? []) { const y = Number(l.annee); if (!y) continue; const r = get(y); r.engage += Number(l.engage) || 0; r.constate += Number(l.constate) || 0; }
    return Array.from(byYear.values()).sort((a, b) => a.annee - b.annee);
  }, [linesQ.data, rhQ.data, ecQ.data]);

  const years = useMemo(() => rows.map((r) => r.annee), [rows]);

  // ── Vue pivot : axe × année pour la métrique choisie ──
  const axisKey = (l: any): string => {
    switch (axis) {
      case 'categorie': return l.categorie || '(sans catégorie)';
      case 'type_depense': return l.type_depense || '(sans type)';
      case 'entite': return l.entite || '(sans entité)';
      case 'projet': return l.it_project_id ? (projName.get(l.it_project_id) ?? '(projet inconnu)') : '(sans projet)';
      default: return '';
    }
  };

  const pivot = useMemo(() => {
    if (axis === 'global') return null;
    const map = new Map<string, Map<number, number>>();
    for (const l of linesQ.data ?? []) {
      const y = Number(l.annee); if (!y) continue;
      const k = axisKey(l);
      const val = metric === 'bud' ? lineAnnualBudget(l) : lineAnnualBudgetRevise(l);
      const row = map.get(k) ?? new Map<number, number>();
      row.set(y, (row.get(y) ?? 0) + val);
      map.set(k, row);
    }
    const rowsArr = Array.from(map.entries()).map(([key, byY]) => {
      const cells = years.map((y) => byY.get(y) ?? 0);
      const total = cells.reduce((s, v) => s + v, 0);
      return { key, cells, total };
    });
    rowsArr.sort((a, b) => b.total - a.total);
    const totalsByYear = years.map((_, i) => rowsArr.reduce((s, r) => s + r.cells[i], 0));
    return { rowsArr, totalsByYear, grandTotal: totalsByYear.reduce((s, v) => s + v, 0) };
  }, [axis, metric, linesQ.data, years, projName]);

  const chartData = useMemo(
    () => rows.map((r) => ({
      annee: String(r.annee),
      Budget: Math.round(r.bud), Reforecast: Math.round(r.reforecast),
      RH: Math.round(r.rh), Constaté: Math.round(r.constate),
    })),
    [rows],
  );

  const pct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : 0);

  // ── Export Excel de la vue affichée ──
  const exportExcel = () => {
    let aoa: (string | number)[][];
    let sheetName: string;
    if (axis === 'global') {
      aoa = [['Exercice', 'Budget (BUD)', 'Reforecast (F)', 'Écart F/BUD', 'Coût RH', 'Total (dont RH)', 'Engagé', 'Constaté']];
      for (const r of rows) aoa.push([r.annee, Math.round(r.bud), Math.round(r.reforecast), Math.round(r.reforecast - r.bud), Math.round(r.rh), Math.round(r.bud + r.rh), Math.round(r.engage), Math.round(r.constate)]);
      sheetName = 'Comparatif global';
    } else {
      aoa = [[AXIS_LABEL[axis], ...years.map(String), 'Total']];
      for (const r of pivot!.rowsArr) aoa.push([r.key, ...r.cells.map(Math.round), Math.round(r.total)]);
      aoa.push(['TOTAL', ...pivot!.totalsByYear.map(Math.round), Math.round(pivot!.grandTotal)]);
      sheetName = `${AXIS_LABEL[axis]} - ${METRIC_LABEL[metric]}`.slice(0, 31);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Comparatif_budget_IT_${axis}_${today}.xlsx`);
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <GitCompareArrows className="h-5 w-5 text-sky-600" />
              Comparatif budgétaire pluriannuel
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Montants annuels HT. Vue globale (avec RH / engagé / constaté) ou pivot par axe.
            </p>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={exportExcel} disabled={isLoading || rows.length === 0}>
            <Download className="h-4 w-4" /> Export Excel
          </Button>
        </div>

        {/* Contrôles axe / métrique */}
        <div className="flex flex-wrap items-end gap-3 pt-2">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Axe</Label>
            <Select value={axis} onValueChange={(v) => setAxis(v as Axis)}>
              <SelectTrigger className="h-8 w-[190px] text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(AXIS_LABEL) as Axis[]).map((a) => (
                  <SelectItem key={a} value={a}>{AXIS_LABEL[a]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {axis !== 'global' && (
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Métrique</Label>
              <Select value={metric} onValueChange={(v) => setMetric(v as Metric)}>
                <SelectTrigger className="h-8 w-[170px] text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
                    <SelectItem key={m} value={m}>{METRIC_LABEL[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune donnée budgétaire.</p>
        ) : axis === 'global' ? (
          <>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis dataKey="annee" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => eurK(v)} tick={{ fontSize: 11 }} width={60} />
                  <Tooltip formatter={(v: number) => eur(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Budget" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Reforecast" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="RH" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Constaté" fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>Exercice</TableHead>
                    <TableHead className="text-right">Budget (BUD)</TableHead>
                    <TableHead className="text-right">Reforecast (F)</TableHead>
                    <TableHead className="text-right">Écart F/BUD</TableHead>
                    <TableHead className="text-right">Coût RH</TableHead>
                    <TableHead className="text-right">Total (dont RH)</TableHead>
                    <TableHead className="text-right">Engagé</TableHead>
                    <TableHead className="text-right">Constaté</TableHead>
                    <TableHead className="text-right">vs N-1</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => {
                    const total = r.bud + r.rh;
                    const prevTotal = i > 0 ? rows[i - 1].bud + rows[i - 1].rh : 0;
                    const ecartF = r.reforecast - r.bud;
                    const evo = i > 0 ? pct(total, prevTotal) : null;
                    return (
                      <TableRow key={r.annee}>
                        <TableCell className="font-semibold">{r.annee}</TableCell>
                        <TableCell className="text-right tabular-nums">{eur(r.bud)}</TableCell>
                        <TableCell className="text-right tabular-nums">{eur(r.reforecast)}</TableCell>
                        <TableCell className={`text-right tabular-nums ${ecartF > 0 ? 'text-red-600' : ecartF < 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                          {ecartF >= 0 ? '+' : ''}{eur(ecartF)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-green-700 dark:text-green-400">{eur(r.rh)}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{eur(total)}</TableCell>
                        <TableCell className="text-right tabular-nums text-indigo-700 dark:text-indigo-400">{r.engage ? eur(r.engage) : '—'}</TableCell>
                        <TableCell className="text-right tabular-nums text-violet-700 dark:text-violet-400">{r.constate ? eur(r.constate) : '—'}</TableCell>
                        <TableCell className={`text-right tabular-nums ${evo == null ? 'text-muted-foreground' : evo > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {evo == null ? '—' : `${evo >= 0 ? '+' : ''}${evo.toFixed(0)} %`}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          // ── Vue pivot ──
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>{AXIS_LABEL[axis]} — {METRIC_LABEL[metric]}</TableHead>
                  {years.map((y) => <TableHead key={y} className="text-right">{y}</TableHead>)}
                  <TableHead className="text-right font-semibold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pivot!.rowsArr.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="font-medium max-w-[260px] truncate" title={r.key}>{r.key}</TableCell>
                    {r.cells.map((v, i) => (
                      <TableCell key={i} className="text-right tabular-nums">{v ? eur(v) : '—'}</TableCell>
                    ))}
                    <TableCell className="text-right tabular-nums font-semibold">{eur(r.total)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 bg-muted/40 font-semibold">
                  <TableCell>TOTAL</TableCell>
                  {pivot!.totalsByYear.map((v, i) => <TableCell key={i} className="text-right tabular-nums">{eur(v)}</TableCell>)}
                  <TableCell className="text-right tabular-nums">{eur(pivot!.grandTotal)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
