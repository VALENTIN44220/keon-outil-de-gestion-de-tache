import { useMemo, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle, TrendingUp, Users, RefreshCw, Info, Bookmark, RotateCcw,
  FlaskConical, Plus, X, Trash2, Loader2,
} from 'lucide-react';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RcTooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { useFdrCapacityMatrix } from '@/hooks/useFdrCapacityMatrix';
import { useFdrProfils, useFdrSettings } from '@/hooks/useFdrSettings';
import { useViewPreferences } from '@/hooks/useViewPreferences';
import { useFdrHireScenarios, type SimulatedHire } from '@/hooks/useFdrHireScenarios';
import {
  type YearGran, type Period, GRAN_CYCLE, GRAN_LETTER, buildPeriods, fmtYMShort,
} from '@/lib/fdr/periods';
import { applyHires, peakOver, peakEtp, type AdjustedMatrix } from '@/lib/fdr/planningSimulation';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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

interface PlanningViewConfig { yearGran: Record<string, YearGran>; }
const PLANNING_VIEW_DEFAULTS: PlanningViewConfig = { yearGran: {} };

type ActiveProfil = { code: string; nom: string; capacite_j_mois: number };

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
  const { data: settings } = useFdrSettings();
  const activeProfils = profils.filter(p => p.actif);
  const joursProductifs = settings?.jours_productifs_mois ?? 18;

  // ---- Vue enregistrée (granularité temporelle) ----
  const { config: view, isLoaded: viewLoaded, save: saveView, reset: resetView, isSaving: viewSaving } =
    useViewPreferences<PlanningViewConfig>('it-planning', PLANNING_VIEW_DEFAULTS);
  const [yearGran, setYearGran] = useState<Record<string, YearGran>>({});
  const [hydrated, setHydrated] = useState(false);
  if (viewLoaded && !hydrated) {
    setYearGran(view.yearGran ?? {});
    setHydrated(true);
  }
  const cycleYearGran = (year: string) =>
    setYearGran(g => ({ ...g, [year]: GRAN_CYCLE[g[year] ?? 'month'] }));

  // ---- Simulation d'embauches ----
  const [hires, setHires] = useState<SimulatedHire[]>([]);

  const months = useMemo(() => matrix?.months ?? [], [matrix]);
  const periods = useMemo(() => buildPeriods(months, yearGran), [months, yearGran]);
  const years = useMemo(() => [...new Set(months.map(m => m.slice(0, 4)))], [months]);

  const adjusted: AdjustedMatrix | null = useMemo(
    () => (matrix ? applyHires(matrix, hires, joursProductifs) : null),
    [matrix, hires, joursProductifs],
  );

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

  if (!matrix || !adjusted) return null;

  const baselinePeakEtp = peakEtp(matrix.rsi_cascade);
  const simPeakEtp = peakEtp(adjusted.cascade);
  const hasHires = hires.length > 0;
  const surchargeMonths = adjusted.cascade.filter(r => r.sous_effectif_net > 0);

  return (
    <div className="space-y-6">
      {/* KPI bar + toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <Badge variant="outline" className="gap-1.5 text-xs py-1">
          <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
          {months.length} mois · {periods.length} colonnes
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
        <Badge variant="outline" className={cn('gap-1.5 text-xs py-1', hasHires ? 'border-violet-300 text-violet-700 bg-violet-50' : '')}>
          ETP à recruter (pic) : <strong>{round1(simPeakEtp)}</strong>
          {hasHires && baselinePeakEtp !== simPeakEtp && (
            <span className="text-muted-foreground">
              {' '}(sans sim. {round1(baselinePeakEtp)} · {simPeakEtp < baselinePeakEtp ? '−' : '+'}{round1(Math.abs(baselinePeakEtp - simPeakEtp))})
            </span>
          )}
        </Badge>

        <div className="ml-auto flex items-center gap-2">
          {/* Granularité par année */}
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="mr-1">Granularité :</span>
            {years.map(y => {
              const g = yearGran[y] ?? 'month';
              return (
                <Button key={y} variant="outline" size="sm" className="h-7 px-2 text-[11px] gap-1"
                  onClick={() => cycleYearGran(y)} title={`${y} — cliquez pour M/T/A`}>
                  {y.slice(2)} <span className="font-bold text-violet-600">{GRAN_LETTER[g]}</span>
                </Button>
              );
            })}
          </div>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs"
            onClick={() => { saveView({ yearGran }); toast({ title: 'Vue enregistrée', description: 'Granularité définie comme votre standard.' }); }}
            disabled={viewSaving} title="Enregistrer la granularité comme votre standard">
            {viewSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bookmark className="h-3.5 w-3.5" />}
            Enregistrer la vue
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => { resetView(); setYearGran({}); toast({ title: 'Vue réinitialisée' }); }}
            title="Réinitialiser la granularité">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-7 gap-1.5">
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
            Recalculer
          </Button>
        </div>
      </div>

      {/* Simulation d'embauches */}
      <SimulationPanel
        activeProfils={activeProfils}
        months={months}
        joursProductifs={joursProductifs}
        hires={hires}
        setHires={setHires}
      />

      {/* Heatmap principale */}
      <HeatmapCard adjusted={adjusted} activeProfils={activeProfils} periods={periods} />

      {/* Sous-effectif différencié par profil */}
      <SousEffectifParProfilCard adjusted={adjusted} activeProfils={activeProfils} periods={periods} joursProductifs={joursProductifs} />

      {/* Cascade RSI (dev/IA + digital, appui RSI) */}
      <CascadeCard adjusted={adjusted} baseline={matrix.rsi_cascade} periods={periods} hasHires={hasHires} />

      {/* Sparklines par profil (mensuel) */}
      <SparklinesCard adjusted={adjusted} activeProfils={activeProfils} months={months} />
    </div>
  );
}

// ---- Simulation panel ----

function SimulationPanel({
  activeProfils, months, joursProductifs, hires, setHires,
}: {
  activeProfils: ActiveProfil[];
  months: string[];
  joursProductifs: number;
  hires: SimulatedHire[];
  setHires: (h: SimulatedHire[]) => void;
}) {
  const { scenarios, create, update, remove } = useFdrHireScenarios();
  const [currentId, setCurrentId] = useState<string>('');
  const [name, setName] = useState('');

  const addHire = () => setHires([
    ...hires,
    { profil_code: activeProfils[0]?.code ?? '', nb_etp: 1, start_ym: months[0] ?? '', kind: 'embauche' },
  ]);
  const patchHire = (i: number, patch: Partial<SimulatedHire>) =>
    setHires(hires.map((h, k) => (k === i ? { ...h, ...patch } : h)));
  const removeHire = (i: number) => setHires(hires.filter((_, k) => k !== i));

  const loadScenario = (id: string) => {
    const s = scenarios.find(x => x.id === id);
    if (!s) { setCurrentId(''); setName(''); setHires([]); return; }
    setCurrentId(s.id); setName(s.nom); setHires(s.hires);
  };

  const saveScenario = () => {
    const nom = name.trim() || 'Scénario sans nom';
    if (currentId) {
      update.mutate({ id: currentId, nom, hires }, { onSuccess: () => toast({ title: 'Scénario mis à jour' }) });
    } else {
      create.mutate({ nom, hires }, {
        onSuccess: (s) => { setCurrentId(s.id); toast({ title: 'Scénario enregistré' }); },
      });
    }
  };

  const deleteScenario = () => {
    if (!currentId) return;
    remove.mutate(currentId, {
      onSuccess: () => { setCurrentId(''); setName(''); setHires([]); toast({ title: 'Scénario supprimé' }); },
    });
  };

  const etpEmbauche = hires.filter(h => (h.kind ?? 'embauche') === 'embauche').reduce((s, h) => s + (Number(h.nb_etp) || 0), 0);
  const etpSousTraitance = hires.filter(h => h.kind === 'sous_traitance').reduce((s, h) => s + (Number(h.nb_etp) || 0), 0);

  return (
    <Card className="border-violet-200/70 bg-violet-50/30 dark:bg-violet-950/10">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="h-4 w-4 text-violet-600" />
          Simulation de renforts
          <span className="text-xs font-normal text-muted-foreground ml-1">
            (what-if non destructif — {round1(etpEmbauche)} ETP embauche · {round1(etpSousTraitance)} ETP sous-traitance)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Gestion des scénarios */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={currentId || '__none__'} onValueChange={(v) => loadScenario(v === '__none__' ? '' : v)}>
            <SelectTrigger className="h-8 text-xs w-56"><SelectValue placeholder="Charger un scénario…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Nouveau scénario —</SelectItem>
              {scenarios.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.nom} ({s.hires.length})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={name} onChange={e => setName(e.target.value)}
            placeholder="Nom du scénario" className="h-8 text-xs w-48"
          />
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
            onClick={saveScenario} disabled={create.isPending || update.isPending || hires.length === 0}>
            <Bookmark className="h-3.5 w-3.5" />{currentId ? 'Mettre à jour' : 'Enregistrer'}
          </Button>
          {currentId && (
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              onClick={deleteScenario} disabled={remove.isPending} title="Supprimer le scénario">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Lignes d'embauche */}
        {hires.length === 0 ? (
          <p className="text-xs text-muted-foreground py-1">
            Aucune embauche simulée. Ajoutez-en pour voir l'impact sur la heatmap et la cascade RSI.
          </p>
        ) : (
          <div className="space-y-2">
            {hires.map((h, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Select value={h.kind ?? 'embauche'} onValueChange={v => patchHire(i, { kind: v as SimulatedHire['kind'] })}>
                  <SelectTrigger className={cn('h-8 text-xs w-36', (h.kind ?? 'embauche') === 'sous_traitance' ? 'border-amber-300 text-amber-700' : 'border-emerald-300 text-emerald-700')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="embauche">👤 Embauche</SelectItem>
                    <SelectItem value="sous_traitance">🤝 Sous-traitance</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={h.profil_code} onValueChange={v => patchHire(i, { profil_code: v })}>
                  <SelectTrigger className="h-8 text-xs w-52"><SelectValue placeholder="Profil" /></SelectTrigger>
                  <SelectContent>
                    {activeProfils.map(p => <SelectItem key={p.code} value={p.code}>{p.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <Input
                    type="number" step="0.5" min="0"
                    value={h.nb_etp}
                    onChange={e => patchHire(i, { nb_etp: Number(e.target.value) })}
                    className="h-8 text-xs w-20"
                  />
                  <span className="text-xs text-muted-foreground">ETP</span>
                </div>
                <span className="text-xs text-muted-foreground">à partir de</span>
                <Select value={h.start_ym} onValueChange={v => patchHire(i, { start_ym: v })}>
                  <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    {months.map(m => <SelectItem key={m} value={m}>{fmtYM(m)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="text-[11px] text-muted-foreground">
                  = +{round1((Number(h.nb_etp) || 0) * joursProductifs)} j/mois
                </span>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeHire(i)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
          onClick={addHire} disabled={activeProfils.length === 0}>
          <Plus className="h-3.5 w-3.5" />Ajouter une embauche
        </Button>
      </CardContent>
    </Card>
  );
}

// ---- Heatmap ----

function HeatmapCard({
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
                    return (
                      <TooltipProvider key={per.key}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <td className={cn(
                              'text-center px-1 py-1.5 tabular-nums rounded cursor-default transition-colors',
                              cellClass(ecart, profil.capacite_j_mois),
                            )}>
                              {demand > 0 ? round1(demand) : <span className="text-muted-foreground/40">—</span>}
                              {added > 0 && <span className="ml-0.5 text-[9px] text-violet-600 font-semibold">+{round1(added)}</span>}
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

function SousEffectifParProfilCard({
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

  // Tri : plus gros sous-effectif d'abord
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

function CascadeCard({
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

  /** Valeur affichée par période = pire (max) sur les mois de la période. */
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

function SparklinesCard({
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
                  {/* Capacité de base (référence) */}
                  <ReferenceLine y={profil.capacite_j_mois} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1.5} />
                  {/* Demande */}
                  <Line type="monotone" dataKey="demande" stroke="#8b5cf6" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                  {/* Capacité ajustée des embauches simulées (escalier) */}
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
