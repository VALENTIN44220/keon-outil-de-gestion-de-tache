import { useMemo, useState, useEffect, useRef, type ReactNode, type Dispatch, type SetStateAction } from 'react';
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
  FlaskConical, Plus, X, Trash2, Loader2, Calendar, Network, Euro, Clock,
  CheckCircle2, ChevronDown, ChevronRight, GitCompare, FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RcTooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { computeCapacityMatrix } from '@/lib/fdr/calculationEngine';
import { useFdrProjectInputs } from '@/hooks/useFdrProjectInputs';
import { useFdrProfils, useFdrSettings } from '@/hooks/useFdrSettings';
import { useViewPreferences } from '@/hooks/useViewPreferences';
import {
  useFdrHireScenarios, type SimulatedHire, type ProjectOverride,
  type ScenarioAssumptions, type FdrHireScenario,
} from '@/hooks/useFdrHireScenarios';
import { useScenarioRoiData } from '@/hooks/useScenarioRoiData';
import {
  type YearGran, type Period, GRAN_CYCLE, GRAN_LETTER, buildPeriods, fmtYMShort,
} from '@/lib/fdr/periods';
import {
  applyHires, applyProjectOverrides, classifyProjects,
  peakOver, peakEtp, type AdjustedMatrix,
} from '@/lib/fdr/planningSimulation';
import { computeScenarioRoi, DEFAULT_ASSUMPTIONS, type ScenarioRoi } from '@/lib/it/scenarioRoi';
import { buildScenariosWorkbook, type ExportScenario } from '@/lib/fdr/scenarioExport';
import { RoiKpi } from '@/components/it/RoiKpi';
import type { FdrProjectInput, FdrEngineSettings } from '@/types/fdr';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ---- Helpers ----

function fmtYM(ym: string): string { return fmtYMShort(ym); }
function round1(n: number) { return Math.round(n * 10) / 10; }
const eur = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

/** 'YYYY-MM-DD' | 'YYYY-MM' | null → 'YYYY-MM' pour <input type="month">. */
function toMonthInput(date: string | null | undefined): string {
  return date ? date.slice(0, 7) : '';
}

/** Overrides projet indexés par it_project_id (état local de l'éditeur). */
type OverrideMap = Record<string, ProjectOverride>;

function overridesToArray(map: OverrideMap): ProjectOverride[] {
  return Object.values(map).filter((o) => {
    // ne garde que les overrides porteurs d'au moins un champ
    const { it_project_id, ...rest } = o;
    return Object.values(rest).some((v) => v !== undefined);
  });
}
function overridesToMap(arr: ProjectOverride[]): OverrideMap {
  return Object.fromEntries((arr ?? []).map((o) => [o.it_project_id, o]));
}

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
  const { data: pinputs, isLoading, error, refetch, isFetching } = useFdrProjectInputs();
  const { data: profils = [] } = useFdrProfils();
  const { data: settings } = useFdrSettings();
  const { data: roiData } = useScenarioRoiData();
  const { scenarios: savedScenarios } = useFdrHireScenarios();
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

  // ---- Leviers du scénario ----
  const [hires, setHires] = useState<SimulatedHire[]>([]);
  const [overrides, setOverrides] = useState<OverrideMap>({});
  const [assumptions, setAssumptions] = useState<ScenarioAssumptions>({});

  const inputs = pinputs?.inputs;
  const engineSettings = pinputs?.engineSettings;

  // Baseline (sans aucun levier) — pour comparer l'ETP à recruter
  const baseline = useMemo(
    () => (inputs && engineSettings ? computeCapacityMatrix(inputs, engineSettings) : null),
    [inputs, engineSettings],
  );

  // Inputs du scénario = inputs + overrides projet (dates / externalisation)
  const scenarioInputs = useMemo(
    () => (inputs ? applyProjectOverrides(inputs, overridesToArray(overrides)) : null),
    [inputs, overrides],
  );

  // Matrice du scénario : recalcul moteur (dates/externe) puis overlay renforts
  const adjusted: AdjustedMatrix | null = useMemo(() => {
    if (!scenarioInputs || !engineSettings) return null;
    const m = computeCapacityMatrix(scenarioInputs, engineSettings);
    return applyHires(m, hires, joursProductifs);
  }, [scenarioInputs, engineSettings, hires, joursProductifs]);

  const classification = useMemo(
    () => (scenarioInputs && adjusted && engineSettings
      ? classifyProjects(scenarioInputs, adjusted, engineSettings)
      : null),
    [scenarioInputs, adjusted, engineSettings],
  );

  const scenarioRoi: ScenarioRoi | null = useMemo(() => {
    if (!classification || !roiData) return null;
    return computeScenarioRoi(
      classification.tenable, roiData.rhHorsITByProject, roiData.tjmMap,
      hires, assumptions, joursProductifs,
    );
  }, [classification, roiData, hires, assumptions, joursProductifs]);

  const months = useMemo(() => adjusted?.months ?? [], [adjusted]);
  const periods = useMemo(() => buildPeriods(months, yearGran), [months, yearGran]);
  const years = useMemo(() => [...new Set(months.map(m => m.slice(0, 4)))], [months]);

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

  if (!inputs || !engineSettings || !adjusted || !baseline) return null;

  const baselinePeakEtp = peakEtp(baseline.rsi_cascade);
  const simPeakEtp = peakEtp(adjusted.cascade);
  const hasLevers = hires.length > 0 || overridesToArray(overrides).length > 0;
  const surchargeMonths = adjusted.cascade.filter(r => r.sous_effectif_net > 0);

  const loadScenario = (s: FdrHireScenario | null) => {
    setHires(s?.hires ?? []);
    setOverrides(overridesToMap(s?.project_overrides ?? []));
    setAssumptions(s?.assumptions ?? {});
  };

  // Export Excel : baseline + tous les scénarios enregistrés (+ l'éditeur courant si modifié)
  const handleExportScenarios = () => {
    const list: ExportScenario[] = [
      { nom: 'Baseline (sans levier)', hires: [], overrides: [], assumptions: {} },
      ...savedScenarios.map(s => ({
        nom: s.nom,
        hires: s.hires ?? [],
        overrides: s.project_overrides ?? [],
        assumptions: s.assumptions ?? {},
      })),
    ];
    if (hasLevers) {
      list.push({
        nom: 'Scénario courant (éditeur)',
        hires,
        overrides: overridesToArray(overrides),
        assumptions,
      });
    }
    const wb = buildScenariosWorkbook({
      inputs, engineSettings, activeProfils, joursProductifs, roiData, scenarios: list,
    });
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    XLSX.writeFile(wb, `Plan_de_charge_scenarios_${stamp}.xlsx`);
    toast({
      title: `${list.length} scénario(s) exporté(s)`,
      description: 'Classeur Excel : 1 feuille de synthèse + 1 feuille par scénario (charge, cascade, ROI).',
    });
  };

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
        <Badge variant="outline" className={cn('gap-1.5 text-xs py-1', hasLevers ? 'border-violet-300 text-violet-700 bg-violet-50' : '')}>
          ETP à recruter (pic) : <strong>{round1(simPeakEtp)}</strong>
          {hasLevers && baselinePeakEtp !== simPeakEtp && (
            <span className="text-muted-foreground">
              {' '}(sans sim. {round1(baselinePeakEtp)} · {simPeakEtp < baselinePeakEtp ? '−' : '+'}{round1(Math.abs(baselinePeakEtp - simPeakEtp))})
            </span>
          )}
        </Badge>
        {classification && (
          <Badge variant="outline" className="gap-1.5 text-xs py-1 border-emerald-300 text-emerald-700 bg-emerald-50">
            <CheckCircle2 className="h-3 w-3" />
            {classification.tenable.length} projets tenables
            {classification.aRisque.length > 0 && (
              <span className="text-red-600"> · {classification.aRisque.length} à risque</span>
            )}
          </Badge>
        )}

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
          <Button variant="outline" size="sm" onClick={handleExportScenarios} className="h-7 gap-1.5 text-xs"
            title="Exporter le plan de charge de tous les scénarios (Excel)">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Exporter scénarios
          </Button>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-7 gap-1.5">
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
            Recalculer
          </Button>
        </div>
      </div>

      {/* Comparateur de scénarios enregistrés */}
      <ScenarioComparator
        inputs={inputs}
        engineSettings={engineSettings}
        roiData={roiData}
        joursProductifs={joursProductifs}
        onLoad={loadScenario}
      />

      {/* Éditeur de scénario (3 leviers) */}
      <ScenarioEditor
        activeProfils={activeProfils}
        projects={inputs}
        months={months}
        joursProductifs={joursProductifs}
        hires={hires}
        setHires={setHires}
        overrides={overrides}
        setOverrides={setOverrides}
        assumptions={assumptions}
        setAssumptions={setAssumptions}
        onLoadScenario={loadScenario}
      />

      {/* ROI agrégé du scénario */}
      {scenarioRoi && <ScenarioRoiCard roi={scenarioRoi} hires={hires} />}

      {/* Projets tenables / à risque */}
      {classification && <ProjectsClassificationCard classification={classification} />}

      {/* Heatmap principale */}
      <HeatmapCard adjusted={adjusted} activeProfils={activeProfils} periods={periods} />

      {/* Sous-effectif différencié par profil */}
      <SousEffectifParProfilCard adjusted={adjusted} activeProfils={activeProfils} periods={periods} joursProductifs={joursProductifs} />

      {/* Cascade RSI (dev/IA + digital, appui RSI) */}
      <CascadeCard adjusted={adjusted} baseline={baseline.rsi_cascade} periods={periods} hasHires={hasLevers} />

      {/* Sparklines par profil (mensuel) */}
      <SparklinesCard adjusted={adjusted} activeProfils={activeProfils} months={months} />
    </div>
  );
}

// ---- Éditeur de scénario (3 leviers) ----

/** Projets pertinents pour les leviers : sur la feuille de route, non abandonnés. */
function fdrProjects(projects: FdrProjectInput[]): FdrProjectInput[] {
  return projects
    .filter(p => p.sur_feuille_de_route && p.statut_portefeuille !== 'Abandonné')
    .sort((a, b) => (a.code ?? '').localeCompare(b.code ?? ''));
}

function CollapsibleSection({
  title, icon, badge, defaultOpen = false, children,
}: {
  title: string;
  icon: ReactNode;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-border/60 bg-background/60">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="text-muted-foreground">{icon}</span>
        {title}
        {badge}
      </button>
      {open && <div className="px-3 pb-3 pt-1 space-y-2">{children}</div>}
    </div>
  );
}

function ScenarioEditor({
  activeProfils, projects, months, joursProductifs,
  hires, setHires, overrides, setOverrides, assumptions, setAssumptions, onLoadScenario,
}: {
  activeProfils: ActiveProfil[];
  projects: FdrProjectInput[];
  months: string[];
  joursProductifs: number;
  hires: SimulatedHire[];
  setHires: (h: SimulatedHire[]) => void;
  overrides: OverrideMap;
  setOverrides: Dispatch<SetStateAction<OverrideMap>>;
  assumptions: ScenarioAssumptions;
  setAssumptions: Dispatch<SetStateAction<ScenarioAssumptions>>;
  onLoadScenario: (s: FdrHireScenario | null) => void;
}) {
  const { scenarios, create, update, remove } = useFdrHireScenarios();
  const [currentId, setCurrentId] = useState<string>('');
  const [name, setName] = useState('');

  // ----- Renforts -----
  const addHire = () => setHires([
    ...hires,
    { profil_code: activeProfils[0]?.code ?? '', nb_etp: 1, start_ym: months[0] ?? '', kind: 'embauche' },
  ]);
  const patchHire = (i: number, patch: Partial<SimulatedHire>) =>
    setHires(hires.map((h, k) => (k === i ? { ...h, ...patch } : h)));
  const removeHire = (i: number) => setHires(hires.filter((_, k) => k !== i));

  // ----- Overrides projet -----
  const patchOverride = (id: string, patch: Partial<ProjectOverride>) =>
    setOverrides(m => ({ ...m, [id]: { it_project_id: id, ...m[id], ...patch } }));
  const resetOverride = (id: string) =>
    setOverrides(m => { const n = { ...m }; delete n[id]; return n; });
  const ovArray = overridesToArray(overrides);

  // ----- Scénarios -----
  const stampRef = useRef<string>('');
  const loadScenario = (id: string) => {
    const s = scenarios.find(x => x.id === id) ?? null;
    setCurrentId(s?.id ?? '');
    setName(s?.nom ?? '');
    stampRef.current = s ? `${s.id}:${(s as any).updated_at ?? ''}` : '';
    onLoadScenario(s);
  };

  // Rechargement auto : si la version ENREGISTRÉE du scénario courant change
  // (ex. modifié depuis la Feuille de route), on recharge depuis la base — les
  // deux pages reflètent toujours la dernière version enregistrée.
  useEffect(() => {
    if (!currentId) return;
    const s = scenarios.find(x => x.id === currentId);
    if (!s) return;
    const stamp = `${s.id}:${(s as any).updated_at ?? ''}`;
    if (stampRef.current === stamp) return;
    stampRef.current = stamp;
    setName(s.nom ?? '');
    onLoadScenario(s);
  }, [scenarios, currentId]); // eslint-disable-line react-hooks/exhaustive-deps
  const saveScenario = () => {
    const nom = name.trim() || 'Scénario sans nom';
    const payload = { nom, hires, project_overrides: ovArray, assumptions };
    if (currentId) {
      update.mutate({ id: currentId, ...payload }, { onSuccess: () => toast({ title: 'Scénario mis à jour' }) });
    } else {
      create.mutate(payload, {
        onSuccess: (s) => { setCurrentId(s.id); toast({ title: 'Scénario enregistré' }); },
      });
    }
  };
  const deleteScenario = () => {
    if (!currentId) return;
    remove.mutate(currentId, {
      onSuccess: () => {
        setCurrentId(''); setName(''); onLoadScenario(null);
        toast({ title: 'Scénario supprimé' });
      },
    });
  };

  const etpEmbauche = hires.filter(h => (h.kind ?? 'embauche') === 'embauche').reduce((s, h) => s + (Number(h.nb_etp) || 0), 0);
  const etpSousTraitance = hires.filter(h => h.kind === 'sous_traitance').reduce((s, h) => s + (Number(h.nb_etp) || 0), 0);
  const fdrList = useMemo(() => fdrProjects(projects), [projects]);
  const nbDates = ovArray.filter(o => o.date_kickoff !== undefined || o.date_mep_saisie !== undefined).length;
  const nbExt = ovArray.filter(o => o.externe !== undefined || o.pct_reduction_si_externe !== undefined || o.budget_externe_eur !== undefined).length;
  const isEmpty = hires.length === 0 && ovArray.length === 0;

  return (
    <Card className="border-violet-200/70 bg-violet-50/30 dark:bg-violet-950/10">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="h-4 w-4 text-violet-600" />
          Éditeur de scénario
          <span className="text-xs font-normal text-muted-foreground ml-1">
            (what-if non destructif — {round1(etpEmbauche)} ETP embauche · {round1(etpSousTraitance)} ETP ST · {nbDates} dates · {nbExt} externalisés)
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
                <SelectItem key={s.id} value={s.id}>{s.nom}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={name} onChange={e => setName(e.target.value)}
            placeholder="Nom du scénario" className="h-8 text-xs w-52"
          />
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
            onClick={saveScenario} disabled={create.isPending || update.isPending || isEmpty}>
            <Bookmark className="h-3.5 w-3.5" />{currentId ? 'Mettre à jour' : 'Enregistrer'}
          </Button>
          {currentId && (
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              onClick={deleteScenario} disabled={remove.isPending} title="Supprimer le scénario">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Levier 1 — Renforts */}
        <CollapsibleSection
          title="Renforts (embauches / sous-traitance)"
          icon={<Users className="h-4 w-4" />}
          defaultOpen
          badge={hires.length > 0 ? <Badge variant="secondary" className="ml-1 text-[10px]">{hires.length}</Badge> : undefined}
        >
          {hires.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">
              Aucun renfort. Ajoutez une embauche ou de la sous-traitance générique.
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
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs mt-1"
            onClick={addHire} disabled={activeProfils.length === 0}>
            <Plus className="h-3.5 w-3.5" />Ajouter un renfort
          </Button>
        </CollapsibleSection>

        {/* Levier 2 — Dates de lancement */}
        <CollapsibleSection
          title="Dates de lancement des projets"
          icon={<Calendar className="h-4 w-4" />}
          badge={nbDates > 0 ? <Badge variant="secondary" className="ml-1 text-[10px]">{nbDates}</Badge> : undefined}
        >
          <div className="max-h-72 overflow-y-auto rounded border border-border/40">
            <table className="text-xs w-full">
              <thead className="sticky top-0 bg-muted/60">
                <tr className="text-muted-foreground">
                  <th className="text-left px-2 py-1.5 font-medium">Projet</th>
                  <th className="text-left px-2 py-1.5 font-medium w-32">Kickoff</th>
                  <th className="text-left px-2 py-1.5 font-medium w-32">MEP saisie</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {fdrList.map(p => {
                  const ov = overrides[p.id];
                  const kickoff = ov?.date_kickoff !== undefined ? ov.date_kickoff : p.date_kickoff;
                  const mep = ov?.date_mep_saisie !== undefined ? ov.date_mep_saisie : p.date_mep_saisie;
                  const dirty = ov?.date_kickoff !== undefined || ov?.date_mep_saisie !== undefined;
                  return (
                    <tr key={p.id} className={cn('border-t border-border/30', dirty && 'bg-violet-50/60')}>
                      <td className="px-2 py-1 truncate max-w-[260px]" title={`${p.code} · ${p.nom}`}>
                        <span className="text-muted-foreground font-mono">{p.code}</span> {p.nom}
                      </td>
                      <td className="px-2 py-1">
                        <Input type="month" value={toMonthInput(kickoff)} className="h-7 text-xs"
                          onChange={e => patchOverride(p.id, { date_kickoff: e.target.value ? `${e.target.value}-01` : null })} />
                      </td>
                      <td className="px-2 py-1">
                        <Input type="month" value={toMonthInput(mep)} className="h-7 text-xs"
                          onChange={e => patchOverride(p.id, { date_mep_saisie: e.target.value ? `${e.target.value}-01` : null })} />
                      </td>
                      <td className="px-1 py-1">
                        {dirty && (
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground"
                            title="Réinitialiser ce projet" onClick={() => resetOverride(p.id)}>
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Override par scénario : la charge build se décale avec le kickoff. Vide = valeur d'origine du projet.
          </p>
        </CollapsibleSection>

        {/* Levier 3 — Externalisation */}
        <CollapsibleSection
          title="Externalisation par projet (sous-traitance)"
          icon={<Network className="h-4 w-4" />}
          badge={nbExt > 0 ? <Badge variant="secondary" className="ml-1 text-[10px]">{nbExt}</Badge> : undefined}
        >
          <div className="max-h-72 overflow-y-auto rounded border border-border/40">
            <table className="text-xs w-full">
              <thead className="sticky top-0 bg-muted/60">
                <tr className="text-muted-foreground">
                  <th className="text-left px-2 py-1.5 font-medium">Projet</th>
                  <th className="text-center px-2 py-1.5 font-medium w-20">Externe</th>
                  <th className="text-left px-2 py-1.5 font-medium w-24">Réduction</th>
                  <th className="text-left px-2 py-1.5 font-medium w-28">Budget ST</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {fdrList.map(p => {
                  const ov = overrides[p.id];
                  const externe = ov?.externe !== undefined ? ov.externe : p.externe;
                  const pct = ov?.pct_reduction_si_externe !== undefined ? ov.pct_reduction_si_externe : p.pct_reduction_si_externe;
                  const budget = ov?.budget_externe_eur !== undefined ? ov.budget_externe_eur : p.budget_externe_eur;
                  const dirty = ov?.externe !== undefined || ov?.pct_reduction_si_externe !== undefined || ov?.budget_externe_eur !== undefined;
                  return (
                    <tr key={p.id} className={cn('border-t border-border/30', dirty && 'bg-amber-50/60')}>
                      <td className="px-2 py-1 truncate max-w-[240px]" title={`${p.code} · ${p.nom}`}>
                        <span className="text-muted-foreground font-mono">{p.code}</span> {p.nom}
                      </td>
                      <td className="px-2 py-1 text-center">
                        <Switch checked={!!externe}
                          onCheckedChange={v => patchOverride(p.id, {
                            externe: v,
                            pct_reduction_si_externe: v && !pct ? 0.3 : pct ?? undefined,
                          })} />
                      </td>
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-1">
                          <Input type="number" min="0" max="100" step="5" disabled={!externe}
                            value={pct != null ? Math.round(pct * 100) : ''} className="h-7 text-xs w-16"
                            onChange={e => patchOverride(p.id, { pct_reduction_si_externe: (Number(e.target.value) || 0) / 100 })} />
                          <span className="text-muted-foreground">%</span>
                        </div>
                      </td>
                      <td className="px-2 py-1">
                        <Input type="number" min="0" step="1000" disabled={!externe}
                          value={budget ?? ''} placeholder="€" className="h-7 text-xs w-24"
                          onChange={e => patchOverride(p.id, { budget_externe_eur: e.target.value ? Number(e.target.value) : null })} />
                      </td>
                      <td className="px-1 py-1">
                        {dirty && (
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground"
                            title="Réinitialiser ce projet" onClick={() => resetOverride(p.id)}>
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Externaliser un projet réduit sa charge interne (% de réduction) et ajoute son budget ST au COGS du ROI.
          </p>
        </CollapsibleSection>

        {/* Hypothèses de coût (ROI) */}
        <CollapsibleSection title="Hypothèses de coût (ROI)" icon={<Euro className="h-4 w-4" />}>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Coût annuel chargé / ETP embauché</label>
              <div className="flex items-center gap-1">
                <Input type="number" min="0" step="1000" className="h-8 text-xs w-32"
                  value={assumptions.cout_annuel_etp_embauche ?? ''}
                  placeholder={String(DEFAULT_ASSUMPTIONS.cout_annuel_etp_embauche)}
                  onChange={e => setAssumptions(a => ({ ...a, cout_annuel_etp_embauche: e.target.value ? Number(e.target.value) : undefined }))} />
                <span className="text-xs text-muted-foreground">€/an</span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">TJM sous-traitance générique</label>
              <div className="flex items-center gap-1">
                <Input type="number" min="0" step="10" className="h-8 text-xs w-28"
                  value={assumptions.tjm_st ?? ''}
                  placeholder={String(DEFAULT_ASSUMPTIONS.tjm_st)}
                  onChange={e => setAssumptions(a => ({ ...a, tjm_st: e.target.value ? Number(e.target.value) : undefined }))} />
                <span className="text-xs text-muted-foreground">€/j</span>
              </div>
            </div>
          </div>
        </CollapsibleSection>
      </CardContent>
    </Card>
  );
}

// ---- ROI agrégé du scénario ----

function ScenarioRoiCard({ roi, hires }: { roi: ScenarioRoi; hires: SimulatedHire[] }) {
  const nbEmb = hires.filter(h => (h.kind ?? 'embauche') === 'embauche').length;
  const nbSt = hires.filter(h => h.kind === 'sous_traitance').length;
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          ROI du scénario
          <span className="text-[11px] font-normal text-muted-foreground">
            (agrégé sur {roi.nb_projets} projets tenables)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <RoiKpi label="Gain annuel" value={eur(roi.gain_annuel_eur)} sub="économies ETP métier"
            color="text-emerald-600" icon={<TrendingUp className="h-4 w-4" />} />
          <RoiKpi label="Coût build RH" value={eur(roi.rh_build_eur)} sub="one-shot"
            color="text-violet-600" icon={<Users className="h-4 w-4" />} />
          <RoiKpi label="COGS (externalisation)" value={eur(roi.cogs_eur)} sub="budgets ST projet"
            color="text-blue-600" icon={<Network className="h-4 w-4" />} />
          <RoiKpi label="Coût embauches" value={eur(roi.cout_embauches_eur)} sub={`${nbEmb} renfort${nbEmb > 1 ? 's' : ''}/an`}
            color="text-amber-600" icon={<Users className="h-4 w-4" />} />
          <RoiKpi label="Coût ST générique" value={eur(roi.cout_st_eur)} sub={`${nbSt} renfort${nbSt > 1 ? 's' : ''}/an`}
            color="text-amber-600" icon={<Euro className="h-4 w-4" />} />
          <RoiKpi label="BILAN annuel" value={eur(roi.bilan_annuel_eur)} sub="gain − coûts"
            color={roi.bilan_annuel_eur >= 0 ? 'text-emerald-600' : 'text-red-600'}
            icon={roi.bilan_annuel_eur >= 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            highlight />
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" />
          Temps de retour :{' '}
          <strong className="text-foreground">
            {roi.temps_retour_an != null
              ? `${roi.temps_retour_an.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} an${roi.temps_retour_an >= 2 ? 's' : ''}`
              : '—'}
          </strong>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Projets tenables / à risque ----

function ProjectsClassificationCard({
  classification,
}: {
  classification: { tenable: FdrProjectInput[]; aRisque: FdrProjectInput[] };
}) {
  const { tenable, aRisque } = classification;
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          Projets que le service peut tenir
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild><Info className="h-4 w-4 text-muted-foreground cursor-help" /></TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Un projet est <strong>tenable</strong> si, sur tous les mois de sa fenêtre build, tous les
                profils qu'il mobilise restent en écart simulé ≥ 0 (compte tenu des renforts et de
                l'externalisation du scénario). Sinon il est <strong>à risque</strong>.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-emerald-700 mb-1.5">
            ✓ Tenables ({tenable.length})
          </p>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {tenable.length === 0 && <p className="text-xs text-muted-foreground">Aucun.</p>}
            {tenable.map(p => (
              <div key={p.id} className="text-xs flex items-center gap-1.5 rounded bg-emerald-50/60 px-2 py-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                <span className="text-muted-foreground font-mono">{p.code}</span>
                <span className="truncate">{p.nom}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-red-700 mb-1.5">
            ⚠ À risque ({aRisque.length})
          </p>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {aRisque.length === 0 && <p className="text-xs text-emerald-600">Aucun — tout passe ✓</p>}
            {aRisque.map(p => (
              <div key={p.id} className="text-xs flex items-center gap-1.5 rounded bg-red-50/60 px-2 py-1">
                <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
                <span className="text-muted-foreground font-mono">{p.code}</span>
                <span className="truncate">{p.nom}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Comparateur de scénarios enregistrés ----

function ScenarioComparator({
  inputs, engineSettings, roiData, joursProductifs, onLoad,
}: {
  inputs: FdrProjectInput[];
  engineSettings: FdrEngineSettings;
  roiData: { rhHorsITByProject: Record<string, any[]>; tjmMap: Record<string, number> } | undefined;
  joursProductifs: number;
  onLoad: (s: FdrHireScenario | null) => void;
}) {
  const { scenarios } = useFdrHireScenarios();

  const rows = useMemo(() => {
    return scenarios.map(s => {
      const sInputs = applyProjectOverrides(inputs, s.project_overrides ?? []);
      const matrix = computeCapacityMatrix(sInputs, engineSettings);
      const adjusted = applyHires(matrix, s.hires ?? [], joursProductifs);
      const { tenable, aRisque } = classifyProjects(sInputs, adjusted, engineSettings);
      const surcharge = adjusted.cascade.filter(r => r.sous_effectif_net > 0).length;
      const roi = roiData
        ? computeScenarioRoi(tenable, roiData.rhHorsITByProject, roiData.tjmMap, s.hires ?? [], s.assumptions ?? {}, joursProductifs)
        : null;
      return {
        s,
        peakEtp: peakEtp(adjusted.cascade),
        surcharge,
        nbTenable: tenable.length,
        nbRisque: aRisque.length,
        bilan: roi?.bilan_annuel_eur ?? null,
        retour: roi?.temps_retour_an ?? null,
      };
    });
  }, [scenarios, inputs, engineSettings, roiData, joursProductifs]);

  if (scenarios.length === 0) return null;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitCompare className="h-4 w-4 text-violet-500" />
          Comparateur de scénarios
          <span className="text-[11px] font-normal text-muted-foreground">({scenarios.length} enregistrés)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="text-xs w-full min-w-max">
          <thead>
            <tr className="text-muted-foreground">
              <th className="text-left px-2 py-1.5 font-medium">Scénario</th>
              <th className="text-center px-2 py-1.5 font-medium">ETP à recruter (pic)</th>
              <th className="text-center px-2 py-1.5 font-medium">Mois surcharge</th>
              <th className="text-center px-2 py-1.5 font-medium">Tenables</th>
              <th className="text-center px-2 py-1.5 font-medium">À risque</th>
              <th className="text-right px-2 py-1.5 font-medium">Bilan annuel</th>
              <th className="text-center px-2 py-1.5 font-medium">Retour</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.s.id} className="border-t border-border/40">
                <td className="px-2 py-1.5 font-medium">{r.s.nom}</td>
                <td className="text-center px-2 py-1.5 tabular-nums">{round1(r.peakEtp)}</td>
                <td className={cn('text-center px-2 py-1.5 tabular-nums', r.surcharge > 0 ? 'text-red-600 font-semibold' : 'text-emerald-600')}>
                  {r.surcharge > 0 ? r.surcharge : '✓'}
                </td>
                <td className="text-center px-2 py-1.5 tabular-nums text-emerald-700">{r.nbTenable}</td>
                <td className={cn('text-center px-2 py-1.5 tabular-nums', r.nbRisque > 0 ? 'text-red-600' : 'text-muted-foreground')}>{r.nbRisque}</td>
                <td className={cn('text-right px-2 py-1.5 tabular-nums font-semibold', (r.bilan ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                  {r.bilan != null ? eur(r.bilan) : '—'}
                </td>
                <td className="text-center px-2 py-1.5 tabular-nums">
                  {r.retour != null ? `${r.retour.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} an${r.retour >= 2 ? 's' : ''}` : '—'}
                </td>
                <td className="px-1 py-1">
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => onLoad(r.s)} title="Charger ce scénario dans l'éditeur">
                    Charger
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
