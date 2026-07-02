/**
 * Visuels de plan de charge (partagés Plan de charge ↔ Feuille de route).
 *
 * Cartes réutilisables prenant une matrice ajustée (AdjustedMatrix) + les profils
 * actifs + les périodes, pour visualiser rapidement l'impact d'un scénario / d'un
 * décalage de projets :
 *   - HeatmapCard             : demande vs capacité (heatmap période × profil)
 *   - SousEffectifParProfilCard : déficit par profil (après simulation)
 *   - CascadeCard             : cascade RSI & ETP à recruter
 *   - SparklinesCard          : courbes mensuelles demande vs capacité par profil
 *
 * Extrait de ITPlanning pour être intégré aussi dans la Feuille de route.
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Users, AlertTriangle, Info } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RcTooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import { fmtYMShort, type Period } from '@/lib/fdr/periods';
import { peakOver, type AdjustedMatrix } from '@/lib/fdr/planningSimulation';

export type ActiveProfil = { code: string; nom: string; capacite_j_mois: number };

// ---- Helpers ----
function fmtYM(ym: string): string { return fmtYMShort(ym); }
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

function periodHeader(per: Period) {
  return (
    <span className="inline-flex flex-col leading-tight">
      <span>{per.label}</span>
      {per.sub && <span className="text-[8px] text-muted-foreground/70">'{per.sub}</span>}
    </span>
  );
}

// ---- Heatmap ----
export function HeatmapCard({
  adjusted, activeProfils, periods,
}: {
  adjusted: AdjustedMatrix;
  activeProfils: ActiveProfil[];
  periods: Period[];
}) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-muted-foreground" />
          Demande vs capacité — heatmap période × profil
          <span className="text-[11px] font-normal text-muted-foreground">(pic de la période)</span>
        </CardTitle>
        <div className="flex gap-3 mt-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 inline-block" /> OK (&gt;6j d'écart)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-200 inline-block" /> Tendu (0–3j)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200 border border-red-300 inline-block" /> Surcharge</span>
          <span className="flex items-center gap-1"><span className="text-violet-600 font-semibold">+n</span> capacité ajoutée (simulation)</span>
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
              {periods.map(per => (
                <th key={per.key} className="text-center font-medium text-muted-foreground px-1 py-1.5 whitespace-nowrap w-16">
                  {periodHeader(per)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeProfils.map(profil => {
              const row = adjusted.by_profil[profil.code];
              if (!row) return null;
              return (
                <tr key={profil.code} className="border-t border-border/40">
                  <td className="text-left px-2 py-1.5 sticky left-0 bg-background z-10 font-medium">
                    {profil.nom}
                  </td>
                  <td className="text-center px-1 py-1.5 text-muted-foreground tabular-nums">
                    {profil.capacite_j_mois} j
                  </td>
                  {periods.map(per => {
                    const peak = peakOver(row.demande, per.months);
                    const demand = peak.value;
                    const ecart = row.ecart[peak.ym] ?? 0;
                    const added = row.addedCap[peak.ym] ?? 0;
                    // Capacité du mois = base + capacité ajoutée (simulation).
                    const cap = profil.capacite_j_mois + added;
                    return (
                      <TooltipProvider key={per.key}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <td className={cn(
                              'text-center px-1 py-1.5 tabular-nums rounded cursor-default transition-colors',
                              cellClass(ecart, profil.capacite_j_mois),
                            )}>
                              {demand > 0
                                ? <>{round1(demand)}<span className="opacity-50">/{round1(cap)}</span>{added > 0 && <span className="ml-0.5 text-[9px] text-violet-600 font-semibold">↑</span>}</>
                                : <span className="text-muted-foreground/40">—</span>}
                            </td>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <p className="font-semibold">{per.kind === 'month' ? fmtYM(per.months[0]) : `${per.label} ${per.sub ?? ''}`} — {profil.nom}</p>
                            <p>Pic demande ({fmtYM(peak.ym)}) : <strong>{round1(demand)} j/mois</strong></p>
                            <p>Capacité : {profil.capacite_j_mois}{added > 0 ? ` (+${round1(added)} simulé)` : ''} j/mois</p>
                            <p className={ecart < 0 ? 'text-red-400' : 'text-emerald-400'}>
                              Écart : {ecart >= 0 ? '+' : ''}{round1(ecart)} j
                            </p>
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

// ---- Sous-effectif par profil ----
export function SousEffectifParProfilCard({
  adjusted, activeProfils, periods, joursProductifs,
}: {
  adjusted: AdjustedMatrix;
  activeProfils: ActiveProfil[];
  periods: Period[];
  joursProductifs: number;
}) {
  const peakDef = (code: string, ms: string[]) =>
    ms.reduce((mx, ym) => Math.max(mx, adjusted.by_profil[code]?.deficit[ym] ?? 0), 0);
  const horizonPeak = (code: string) =>
    adjusted.months.reduce((mx, ym) => Math.max(mx, adjusted.by_profil[code]?.deficit[ym] ?? 0), 0);
  const horizonMax = (rec: Record<string, number> | undefined) =>
    rec ? adjusted.months.reduce((mx, ym) => Math.max(mx, rec[ym] ?? 0), 0) : 0;

  const rows = [...activeProfils].sort((a, b) => horizonPeak(b.code) - horizonPeak(a.code));
  const anyDeficit = rows.some(p => horizonPeak(p.code) > 0);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          Sous-effectif par profil
          <span className="text-[11px] font-normal text-muted-foreground">(après simulation — pic de la période)</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Déficit propre à chaque profil = max(0, demande − capacité simulée). Les profils sans ressource interne
          (ex. <em>Responsable IT</em>) ressortent ici : la <strong>sous-traitance</strong> simulée résorbe leur déficit.
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="text-xs border-collapse w-full min-w-max">
          <thead>
            <tr>
              <th className="text-left font-medium text-muted-foreground px-2 py-1.5 sticky left-0 bg-background z-10 min-w-[160px]">Profil</th>
              <th className="text-center font-medium text-muted-foreground px-2 py-1.5 whitespace-nowrap w-28">Pic sous-effectif</th>
              {periods.map(per => (
                <th key={per.key} className="text-center font-medium text-muted-foreground px-1 py-1.5 whitespace-nowrap w-16">
                  {periodHeader(per)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(profil => {
              const code = profil.code;
              const peak = horizonPeak(code);
              const etp = joursProductifs > 0 ? peak / joursProductifs : 0;
              const addEmb = horizonMax(adjusted.by_profil[code]?.addedEmbauche);
              const addSst = horizonMax(adjusted.by_profil[code]?.addedSousTraitance);
              return (
                <tr key={code} className={cn('border-t border-border/40', peak <= 0 && 'opacity-60')}>
                  <td className="text-left px-2 py-1.5 sticky left-0 bg-background z-10 font-medium">
                    {profil.nom}
                    {(addEmb > 0 || addSst > 0) && (
                      <span className="block text-[9px] font-normal text-muted-foreground">
                        {addEmb > 0 && <span className="text-emerald-600">+{round1(addEmb)} emb</span>}
                        {addEmb > 0 && addSst > 0 && ' · '}
                        {addSst > 0 && <span className="text-amber-600">+{round1(addSst)} ST</span>}
                      </span>
                    )}
                  </td>
                  <td className={cn('text-center px-2 py-1.5 tabular-nums', peak > 0 ? 'text-red-700 font-semibold' : 'text-emerald-600')}>
                    {peak > 0 ? <>{round1(peak)} j <span className="text-[10px] text-muted-foreground">({round1(etp)} ETP)</span></> : '✓'}
                  </td>
                  {periods.map(per => {
                    const v = peakDef(code, per.months);
                    return (
                      <td key={per.key} className={cn('text-center px-1 py-1.5 tabular-nums', v > 0 ? 'text-red-700 font-semibold bg-red-50' : 'text-muted-foreground')}>
                        {v > 0 ? round1(v) : <span className="opacity-30">—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!anyDeficit && (
          <p className="text-xs text-emerald-600 mt-2">✓ Aucun sous-effectif sur l'horizon (compte tenu de la simulation).</p>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Cascade RSI ----
export function CascadeCard({
  adjusted, baseline, periods, hasHires,
}: {
  adjusted: AdjustedMatrix;
  baseline: { ym: string; etp_a_recruter: number }[];
  periods: Period[];
  hasHires: boolean;
}) {
  const cascadeByYm = useMemo(() => new Map(adjusted.cascade.map(r => [r.ym, r])), [adjusted.cascade]);
  const baselineByYm = useMemo(() => new Map(baseline.map(r => [r.ym, r])), [baseline]);
  const hasSurcharge = adjusted.cascade.some(r => r.sous_effectif_net > 0);

  const periodMax = (per: Period, key: 'sous_effectif_projets' | 'appui_rsi' | 'sous_effectif_net' | 'etp_a_recruter') =>
    per.months.reduce((mx, ym) => Math.max(mx, cascadeByYm.get(ym)?.[key] ?? 0), 0);

  const baselineEtpMax = (per: Period) =>
    per.months.reduce((mx, ym) => Math.max(mx, baselineByYm.get(ym)?.etp_a_recruter ?? 0), 0);

  const rows = [
    { key: 'sous_effectif_projets' as const, label: 'Sous-effectif projets (j)', warning: true },
    { key: 'appui_rsi' as const, label: 'Appui RSI mobilisé (j)', warning: false },
    { key: 'sous_effectif_net' as const, label: 'Sous-effectif net (j)', warning: true },
    { key: 'etp_a_recruter' as const, label: 'ETP à recruter', warning: true },
  ];

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
                <p className="mt-1 text-violet-300">Recalculé avec les embauches simulées.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="text-xs border-collapse w-full min-w-max">
          <thead>
            <tr>
              <th className="text-left font-medium text-muted-foreground px-2 py-1.5 sticky left-0 bg-background z-10 min-w-[220px]">
                Indicateur
              </th>
              {periods.map(per => (
                <th key={per.key} className="text-center font-medium text-muted-foreground px-1 py-1.5 whitespace-nowrap w-16">
                  {periodHeader(per)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, label, warning }) => (
              <tr key={key} className="border-t border-border/40">
                <td className="text-left px-2 py-1.5 sticky left-0 bg-background z-10 font-medium">{label}</td>
                {periods.map(per => {
                  const val = periodMax(per, key);
                  const bad = warning && val > 0;
                  return (
                    <td key={per.key} className={cn(
                      'text-center px-1 py-1.5 tabular-nums',
                      bad ? 'text-red-700 font-semibold bg-red-50' : 'text-muted-foreground',
                    )}>
                      {val > 0 ? round1(val) : <span className="opacity-30">—</span>}
                      {key === 'sous_effectif_net' && val > 0 && (
                        <span className="ml-1"><AlertTriangle className="h-3 w-3 inline text-red-500" /></span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {hasHires && (
              <tr className="border-t border-border/40 bg-muted/30">
                <td className="text-left px-2 py-1.5 sticky left-0 bg-background z-10 text-muted-foreground italic">
                  ETP à recruter (sans simulation)
                </td>
                {periods.map(per => {
                  const val = baselineEtpMax(per);
                  return (
                    <td key={per.key} className="text-center px-1 py-1.5 tabular-nums text-muted-foreground/70 line-through">
                      {val > 0 ? round1(val) : <span className="opacity-30">—</span>}
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ---- Sparklines (mensuel) ----
export function SparklinesCard({
  adjusted, activeProfils, months,
}: {
  adjusted: AdjustedMatrix;
  activeProfils: ActiveProfil[];
  months: string[];
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground px-1">
        <span className="flex items-center gap-1.5"><span className="w-6 h-0.5 bg-[#8b5cf6] inline-block" /> Demande</span>
        <span className="flex items-center gap-1.5"><span className="w-6 h-0.5 bg-[#10b981] inline-block" /> Capacité avec embauches simulées</span>
        <span className="flex items-center gap-1.5"><span className="w-6 border-t-2 border-dashed border-[#ef4444] inline-block" /> Capacité de base</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {activeProfils.map(profil => {
        const row = adjusted.by_profil[profil.code];
        if (!row) return null;

        const chartData = months.map(ym => ({
          ym: fmtYM(ym),
          demande: round1(row.demande[ym] ?? 0),
          capacite: round1(profil.capacite_j_mois + (row.addedCap[ym] ?? 0)),
        }));

        const maxDemand = Math.max(0, ...Object.values(row.demande));
        const picYm = months.find(ym => (row.demande[ym] ?? 0) === maxDemand);
        const isSurcharge = months.some(ym => (row.ecart[ym] ?? 0) < 0);

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
                  {picYm && <span className="text-muted-foreground ml-1">({fmtYM(picYm)})</span>}
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
                      name === 'demande' ? 'Demande' : 'Capacité (avec simulation)',
                    ]}
                  />
                  <ReferenceLine y={profil.capacite_j_mois} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1.5} />
                  <Line type="monotone" dataKey="demande" stroke="#8b5cf6" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                  <Line type="stepAfter" dataKey="capacite" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );
      })}
      </div>
    </div>
  );
}
