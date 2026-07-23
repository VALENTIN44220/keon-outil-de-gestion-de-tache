/**
 * ITBudgetYearCompare — comparatif pluriannuel du budget IT.
 *
 * Agrège, par exercice, le Budget initial (BUD), le Reforecast (F), le coût RH,
 * l'engagé et le constaté (Divalto), pour comparer les années entre elles.
 * Budget/reforecast calculés via le canon annuel (lineAnnualBudget/Revise).
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { GitCompareArrows } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts';
import { lineAnnualBudget, lineAnnualBudgetRevise } from '@/lib/itBudgetTotals';

const eur = (n: number) =>
  (Number(n) || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eurK = (n: number) => `${Math.round((Number(n) || 0) / 1000)} k€`;

interface YearRow {
  annee: number;
  bud: number;
  reforecast: number;
  rh: number;
  engage: number;
  constate: number;
}

export function ITBudgetYearCompare() {
  // Lignes budgétaires (tous exercices) — champs nécessaires au canon annuel.
  const linesQ = useQuery({
    queryKey: ['it-budget-compare-lines'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('it_budget_lines')
        .select('annee, budget_type, montant_budget, montant_budget_revise, montant_annuel, mois_budget, budget_type_revise, mois_budget_revise');
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const rhQ = useQuery({
    queryKey: ['it-budget-compare-rh'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_it_rh_cout')
        .select('annee, cout_charge_annuel');
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const ecQ = useQuery({
    queryKey: ['it-budget-compare-engage-constate'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_it_budget_engage_constate')
        .select('annee, engage, constate');
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const rows: YearRow[] = useMemo(() => {
    const byYear = new Map<number, YearRow>();
    const get = (annee: number): YearRow => {
      let r = byYear.get(annee);
      if (!r) { r = { annee, bud: 0, reforecast: 0, rh: 0, engage: 0, constate: 0 }; byYear.set(annee, r); }
      return r;
    };
    for (const l of linesQ.data ?? []) {
      const y = Number(l.annee);
      if (!y) continue;
      const r = get(y);
      r.bud += lineAnnualBudget(l);
      r.reforecast += lineAnnualBudgetRevise(l);
    }
    for (const l of rhQ.data ?? []) {
      const y = Number(l.annee);
      if (!y) continue;
      get(y).rh += Number(l.cout_charge_annuel) || 0;
    }
    for (const l of ecQ.data ?? []) {
      const y = Number(l.annee);
      if (!y) continue;
      const r = get(y);
      r.engage += Number(l.engage) || 0;
      r.constate += Number(l.constate) || 0;
    }
    return Array.from(byYear.values()).sort((a, b) => a.annee - b.annee);
  }, [linesQ.data, rhQ.data, ecQ.data]);

  const isLoading = linesQ.isLoading || rhQ.isLoading || ecQ.isLoading;

  const chartData = useMemo(
    () => rows.map((r) => ({
      annee: String(r.annee),
      Budget: Math.round(r.bud),
      Reforecast: Math.round(r.reforecast),
      RH: Math.round(r.rh),
      'Total (dont RH)': Math.round(r.bud + r.rh),
      Constaté: Math.round(r.constate),
    })),
    [rows],
  );

  const pct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : 0);

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <GitCompareArrows className="h-5 w-5 text-sky-600" />
            Comparatif budgétaire pluriannuel
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Budget initial (BUD), reforecast (F), coût RH, engagé et constaté par exercice.
            Montants annuels HT. Le « Total » ajoute le coût RH au budget initial.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune donnée budgétaire.</p>
          ) : (
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
                      <TableHead className="text-right">Écart F / BUD</TableHead>
                      <TableHead className="text-right">Coût RH</TableHead>
                      <TableHead className="text-right">Total (dont RH)</TableHead>
                      <TableHead className="text-right">Engagé</TableHead>
                      <TableHead className="text-right">Constaté</TableHead>
                      <TableHead className="text-right">vs N-1 (Total)</TableHead>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
