import { useMemo, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, AlertTriangle, TrendingUp, Users, RefreshCw, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RcTooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { useFdrCapacityMatrix } from '@/hooks/useFdrCapacityMatrix';
import { useFdrProfils } from '@/hooks/useFdrSettings';
import type { FdrProfilCapacityRow, FdrRsiCascadeRow } from '@/types/fdr';
import { cn } from '@/lib/utils';

// ---- Helpers ----

function fmtYM(ym: string): string {
  const [y, m] = ym.split('-');
  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
}

function round1(n: number) { return Math.round(n * 10) / 10; }

/** Couleur de cellule heatmap selon l'écart capacité − demande. */
function cellClass(ecart: number, capacite: number): string {
  if (capacite === 0) return 'bg-slate-100 text-slate-400';
  if (ecart > 6)  return 'bg-emerald-100 text-emerald-800';
  if (ecart > 3)  return 'bg-emerald-50 text-emerald-700';
  if (ecart >= 0) return 'bg-amber-50 text-amber-700';
  if (ecart > -3) return 'bg-red-100 text-red-700';
  if (ecart > -6) return 'bg-red-200 text-red-800';
  return 'bg-red-300 text-red-900 font-bold';
}

// ---- Page principale ----

export default function ITPlanning() {
  return (
    <Layout>
      <div className="p-6 space-y-6">
        <Header />
        <PlanningContent />
      </div>
    </Layout>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-3xl font-display font-bold flex items-center gap-3">
        <div className="p-2 rounded-xl bg-violet-500/10">
          <TrendingUp className="h-7 w-7 text-violet-500" />
        </div>
        Plan de charge IT
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Demande mensuelle par profil vs capacité — recalculé à partir des projets actifs de la feuille de route.
        Unité : <strong>j/mois</strong>. La métrique de dimensionnement est le <strong>pic mensuel</strong>.
      </p>
    </div>
  );
}

function PlanningContent() {
  const { data: matrix, isLoading, error, refetch, isFetching } = useFdrCapacityMatrix();
  const { data: profils = [] } = useFdrProfils();
  const activeProfils = profils.filter(p => p.actif);

  if (isLoading) return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
    </div>
  );

  if (error) return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="p-6 flex items-center gap-3 text-destructive">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        Erreur lors du calcul du plan de charge.
      </CardContent>
    </Card>
  );

  if (!matrix) return null;

  const months = matrix.months;
  const surchargeMonths = matrix.rsi_cascade.filter(r => r.sous_effectif_net > 0);

  return (
    <div className="space-y-6">
      {/* KPI bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <Badge variant="outline" className="gap-1.5 text-xs py-1">
          <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
          {months.length} mois planifiés
        </Badge>
        {surchargeMonths.length > 0 ? (
          <Badge variant="outline" className="gap-1.5 text-xs py-1 border-red-300 text-red-700 bg-red-50">
            <AlertTriangle className="h-3 w-3" />
            {surchargeMonths.length} mois en surcharge nette
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1.5 text-xs py-1 border-emerald-300 text-emerald-700 bg-emerald-50">
            ✓ Aucune surcharge nette
          </Badge>
        )}
        <Button
          variant="ghost" size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-7 gap-1.5 ml-auto"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
          Recalculer
        </Button>
      </div>

      {/* Heatmap principale */}
      <HeatmapCard matrix={matrix} activeProfils={activeProfils} months={months} />

      {/* Cascade RSI */}
      <RsiCascadeCard cascade={matrix.rsi_cascade} months={months} />

      {/* Sparklines par profil */}
      <SparklinesCard matrix={matrix} activeProfils={activeProfils} months={months} />
    </div>
  );
}

// ---- Heatmap ----

function HeatmapCard({
  matrix,
  activeProfils,
  months,
}: {
  matrix: ReturnType<typeof useFdrCapacityMatrix>['data'] & {};
  activeProfils: { code: string; nom: string; capacite_j_mois: number }[];
  months: string[];
}) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-muted-foreground" />
          Demande vs capacité — heatmap mois × profil
        </CardTitle>
        <div className="flex gap-3 mt-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 inline-block" /> OK (&gt;6j d'écart)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-200 inline-block" /> Tendu (0–3j)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200 border border-red-300 inline-block" /> Surcharge</span>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="text-xs border-collapse w-full min-w-max">
          <thead>
            <tr>
              <th className="text-left font-medium text-muted-foreground px-2 py-1.5 sticky left-0 bg-background z-10 min-w-[160px]">
                Profil
              </th>
              <th className="text-center font-medium text-muted-foreground px-1 py-1.5 whitespace-nowrap w-20">
                Capacité
              </th>
              {months.map(ym => (
                <th key={ym} className="text-center font-medium text-muted-foreground px-1 py-1.5 whitespace-nowrap w-16">
                  {fmtYM(ym)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeProfils.map(profil => {
              const row = matrix.by_profil[profil.code];
              if (!row) return null;
              const picYm = row.pic?.ym;
              return (
                <tr key={profil.code} className="border-t border-border/40">
                  <td className="text-left px-2 py-1.5 sticky left-0 bg-background z-10 font-medium">
                    {profil.nom}
                  </td>
                  <td className="text-center px-1 py-1.5 text-muted-foreground tabular-nums">
                    {profil.capacite_j_mois} j
                  </td>
                  {months.map(ym => {
                    const demand = row.demande[ym] ?? 0;
                    const ecart = row.ecart[ym] ?? 0;
                    const isPic = ym === picYm && demand > 0;
                    return (
                      <TooltipProvider key={ym}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <td className={cn(
                              'text-center px-1 py-1.5 tabular-nums rounded cursor-default transition-colors',
                              cellClass(ecart, profil.capacite_j_mois),
                              isPic && 'ring-1 ring-violet-400 ring-inset',
                            )}>
                              {demand > 0 ? round1(demand) : <span className="text-muted-foreground/40">—</span>}
                              {isPic && <span className="ml-0.5 text-[9px] text-violet-600">▲</span>}
                            </td>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <p className="font-semibold">{fmtYM(ym)} — {profil.nom}</p>
                            <p>Demande : <strong>{round1(demand)} j/mois</strong></p>
                            <p>Capacité : {profil.capacite_j_mois} j/mois</p>
                            <p className={ecart < 0 ? 'text-red-400' : 'text-emerald-400'}>
                              Écart : {ecart >= 0 ? '+' : ''}{round1(ecart)} j
                            </p>
                            {isPic && <p className="text-violet-400 mt-1">▲ Pic mensuel</p>}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ---- Cascade RSI ----

function RsiCascadeCard({ cascade, months }: { cascade: FdrRsiCascadeRow[]; months: string[] }) {
  const hasSurcharge = cascade.some(r => r.sous_effectif_net > 0);

  return (
    <Card className={cn('border-border/50', hasSurcharge && 'border-red-200')}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span>Cascade RSI & ETP à recruter</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                <p><strong>Sous-effectif projets</strong> = déficit dev/IA + déficit digital</p>
                <p><strong>Appui RSI</strong> = disponibilité RSI mobilisée en appui (jusqu'à épuisement)</p>
                <p><strong>Sous-effectif net</strong> = sous-effectif après appui RSI</p>
                <p><strong>ETP à recruter</strong> = sous-effectif net ÷ jours productifs/mois</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="text-xs border-collapse w-full min-w-max">
          <thead>
            <tr>
              <th className="text-left font-medium text-muted-foreground px-2 py-1.5 sticky left-0 bg-background z-10 min-w-[200px]">
                Indicateur
              </th>
              {months.map(ym => (
                <th key={ym} className="text-center font-medium text-muted-foreground px-1 py-1.5 whitespace-nowrap w-16">
                  {fmtYM(ym)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { key: 'sous_effectif_projets' as const, label: 'Sous-effectif projets (j)', warning: true },
              { key: 'appui_rsi' as const, label: 'Appui RSI mobilisé (j)', warning: false },
              { key: 'sous_effectif_net' as const, label: 'Sous-effectif net (j)', warning: true },
              { key: 'etp_a_recruter' as const, label: 'ETP à recruter', warning: true },
            ].map(({ key, label, warning }) => (
              <tr key={key} className="border-t border-border/40">
                <td className="text-left px-2 py-1.5 sticky left-0 bg-background z-10 font-medium">
                  {label}
                </td>
                {cascade.map(row => {
                  const val = row[key];
                  const bad = warning && val > 0;
                  return (
                    <td key={row.ym} className={cn(
                      'text-center px-1 py-1.5 tabular-nums',
                      bad ? 'text-red-700 font-semibold bg-red-50' : 'text-muted-foreground',
                    )}>
                      {val > 0 ? round1(val) : <span className="opacity-30">—</span>}
                      {key === 'sous_effectif_net' && val > 0 && (
                        <span className="ml-1">
                          <AlertTriangle className="h-3 w-3 inline text-red-500" />
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ---- Sparklines ----

function SparklinesCard({
  matrix,
  activeProfils,
  months,
}: {
  matrix: ReturnType<typeof useFdrCapacityMatrix>['data'] & {};
  activeProfils: { code: string; nom: string; capacite_j_mois: number }[];
  months: string[];
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {activeProfils.map(profil => {
        const row = matrix.by_profil[profil.code];
        if (!row) return null;

        const chartData = months.map(ym => ({
          ym: fmtYM(ym),
          demande: round1(row.demande[ym] ?? 0),
          capacite: profil.capacite_j_mois,
        }));

        const pic = row.pic;
        const maxDemand = Math.max(...Object.values(row.demande));
        const isSurcharge = Object.values(row.ecart).some(e => e < 0);

        return (
          <Card key={profil.code} className={cn('border-border/50', isSurcharge && 'border-red-200')}>
            <CardHeader className="pb-1 pt-3 px-4">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm font-medium leading-tight">{profil.nom}</CardTitle>
                {isSurcharge ? (
                  <Badge className="text-[10px] shrink-0 bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
                    <AlertTriangle className="h-2.5 w-2.5 mr-1" />Surcharge
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] shrink-0">OK</Badge>
                )}
              </div>
              <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                <span>Cap. <strong className="text-foreground">{profil.capacite_j_mois} j</strong></span>
                <span>Pic <strong className={cn(maxDemand > profil.capacite_j_mois ? 'text-red-600' : 'text-foreground')}>{round1(maxDemand)} j</strong>
                  {pic && <span className="text-muted-foreground ml-1">({fmtYM(pic.ym)})</span>}
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-3 pt-1">
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="ym" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9 }} />
                  <RcTooltip
                    contentStyle={{ fontSize: 11 }}
                    formatter={(v: number, name: string) => [
                      `${v} j/mois`,
                      name === 'demande' ? 'Demande' : 'Capacité',
                    ]}
                  />
                  <ReferenceLine y={profil.capacite_j_mois} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1.5} />
                  <Line
                    type="monotone"
                    dataKey="demande"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
