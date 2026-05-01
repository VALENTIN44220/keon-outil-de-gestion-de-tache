import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart3,
  Table as TableIcon,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBEAffaireMonthly } from '@/hooks/useBEAffaireMonthly';

const eur = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const numj = (n: number) =>
  n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

interface BEAffaireMonthlyBreakdownProps {
  codeAffaire: string;
  dateFrom: string | null;
  dateTo: string | null;
}

type ViewMode = 'chart' | 'table';

export function BEAffaireMonthlyBreakdown({
  codeAffaire,
  dateFrom,
  dateTo,
}: BEAffaireMonthlyBreakdownProps) {
  const { data: rows = [], isLoading } = useBEAffaireMonthly(codeAffaire, dateFrom, dateTo);
  const [view, setView] = useState<ViewMode>('chart');

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        mois: format(new Date(r.date), 'MMM yy', { locale: fr }),
        moisIso: r.mois,
        'CA Constaté': r.ca_constate,
        'COGS Const.': r.cogs_constate > 0 ? -r.cogs_constate : 0,
        'NDF': r.ndf > 0 ? -r.ndf : 0,
        'Coût RH': r.cout_rh > 0 ? -r.cout_rh : 0,
        'Marge directe': r.marge_directe,
      })),
    [rows],
  );

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-4">
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return null;
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Vue mensuelle · CA / COGS / NDF / RH
          </CardTitle>
          <div className="flex items-center gap-1 p-0.5 bg-muted/50 rounded">
            <Button
              variant={view === 'chart' ? 'default' : 'ghost'}
              size="sm"
              className={cn('h-7 px-2 text-[11px]', view === 'chart' && 'shadow-sm')}
              onClick={() => setView('chart')}
            >
              <BarChart3 className="h-3.5 w-3.5 mr-1" />
              Graphique
            </Button>
            <Button
              variant={view === 'table' ? 'default' : 'ghost'}
              size="sm"
              className={cn('h-7 px-2 text-[11px]', view === 'table' && 'shadow-sm')}
              onClick={() => setView('table')}
            >
              <TableIcon className="h-3.5 w-3.5 mr-1" />
              Table
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {view === 'chart' ? (
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <RTooltip
                  formatter={(v: number, name: string) => {
                    const isCost = name === 'COGS Const.' || name === 'NDF' || name === 'Coût RH';
                    return [eur(isCost ? Math.abs(v) : v), name];
                  }}
                  labelStyle={{ fontWeight: 600 }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="CA Constaté" fill="#6366f1" stackId="rev" />
                <Bar dataKey="COGS Const." fill="#f59e0b" stackId="cost" />
                <Bar dataKey="NDF" fill="#fb7185" stackId="cost" />
                <Bar dataKey="Coût RH" fill="#8b5cf6" stackId="cost" />
                <Line
                  type="monotone"
                  dataKey="Marge directe"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="overflow-x-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>Mois</TableHead>
                  <TableHead className="text-right">CA Const.</TableHead>
                  <TableHead className="text-right">COGS Const.</TableHead>
                  <TableHead className="text-right">NDF</TableHead>
                  <TableHead className="text-right">Marge brute</TableHead>
                  <TableHead className="text-right">Jours</TableHead>
                  <TableHead className="text-right">Coût RH</TableHead>
                  <TableHead className="text-right">Marge directe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const bruteNeg = r.marge_brute < 0;
                  const directeNeg = r.marge_directe < 0;
                  return (
                    <TableRow key={r.mois}>
                      <TableCell className="font-medium capitalize">
                        {format(new Date(r.date), 'MMMM yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {r.ca_constate > 0 ? eur(r.ca_constate) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {r.cogs_constate > 0 ? eur(r.cogs_constate) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {r.ndf > 0 ? eur(r.ndf) : '—'}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right tabular-nums font-semibold',
                          bruteNeg && 'text-red-600',
                          !bruteNeg && r.marge_brute > 0 && 'text-emerald-600',
                        )}
                      >
                        {r.marge_brute !== 0 ? eur(r.marge_brute) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.jours > 0 ? `${numj(r.jours)} j` : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {r.cout_rh > 0 ? eur(r.cout_rh) : '—'}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right tabular-nums font-semibold',
                          directeNeg && 'text-red-600',
                          !directeNeg && r.marge_directe > 0 && 'text-emerald-600',
                        )}
                      >
                        {r.marge_directe !== 0 ? eur(r.marge_directe) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-emerald-600" />
            Marge positive
          </span>
          <span className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3 text-red-600" />
            Marge négative
          </span>
          {dateFrom && dateTo && (
            <span className="ml-auto">
              Période : {format(new Date(dateFrom), 'dd/MM/yy')} → {format(new Date(dateTo), 'dd/MM/yy')}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
