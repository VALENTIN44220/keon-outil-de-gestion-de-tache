/**
 * BEPlanning — Plan de charge du Bureau d'Études.
 * Heatmap collaborateur × période (mois/trimestre/année), capacité vs charge
 * projetée, temps réel Lucca, et détail dépliable par affaire/projet.
 */
import { useMemo, useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  BarChart2, ChevronRight, ChevronDown, Bookmark, RotateCcw, RefreshCw, Search, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBECapacityMatrix, type BECapacityRow, type BECapacityCell } from '@/hooks/useBECapacityMatrix';
import { useViewPreferences } from '@/hooks/useViewPreferences';
import {
  type YearGran, type Period, GRAN_CYCLE, GRAN_LETTER, buildPeriods,
} from '@/lib/fdr/periods';
import { toast } from '@/hooks/use-toast';

const POSTE_LABELS: Record<string, string> = {
  charge_affaires: "Chargé d'affaires",
  ingenieur_etudes: 'Ingénieur études',
  ingenieur_realisation: 'Ingénieur réalisation',
  projeteur: 'Projeteur',
  developpeur: 'Développeur',
  autre: 'Autre',
};

const num = (n: number) => (Math.round((Number(n) || 0) * 10) / 10).toLocaleString('fr-FR');

/** Couleur de cellule selon l'écart capacité − projeté (en jours, agrégé période). */
function cellClass(ecart: number): string {
  if (ecart > 8) return 'bg-emerald-100 text-emerald-900';
  if (ecart > 3) return 'bg-emerald-50 text-emerald-800';
  if (ecart >= 0) return 'bg-amber-50 text-amber-800';
  if (ecart > -5) return 'bg-red-100 text-red-800';
  if (ecart > -10) return 'bg-red-200 text-red-900';
  return 'bg-red-300 text-red-950';
}

interface BEViewConfig { yearGran: Record<string, YearGran>; }
const BE_VIEW_DEFAULTS: BEViewConfig = { yearGran: {} };

/** Agrège les cellules mensuelles sur les mois d'une période (somme). */
function aggCell(cells: Record<string, BECapacityCell>, months: string[]): BECapacityCell {
  let capacity = 0, reel = 0, projete = 0;
  for (const m of months) {
    const c = cells[m];
    if (!c) continue;
    capacity += c.capacity; reel += c.reel; projete += c.projete;
  }
  return { capacity, reel, projete, ecart: capacity - projete };
}
function aggDetail(byYm: Record<string, { projete: number; reel: number }>, months: string[]) {
  let projete = 0, reel = 0;
  for (const m of months) { const v = byYm[m]; if (v) { projete += v.projete; reel += v.reel; } }
  return { projete, reel };
}

export default function BEPlanning() {
  const [activeView, setActiveView] = useState('be-planning');
  const { matrix, isLoading, refetch } = useBECapacityMatrix();

  const { config: view, isLoaded: viewLoaded, save: saveView, reset: resetView, isSaving } =
    useViewPreferences<BEViewConfig>('be-planning', BE_VIEW_DEFAULTS);
  const [yearGran, setYearGran] = useState<Record<string, YearGran>>({});
  const [hydrated, setHydrated] = useState(false);
  if (viewLoaded && !hydrated) { setYearGran(view.yearGran ?? {}); setHydrated(true); }
  const cycleYearGran = (year: string) =>
    setYearGran(g => ({ ...g, [year]: GRAN_CYCLE[g[year] ?? 'month'] }));

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setExpanded(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [filterPoste, setFilterPoste] = useState('__all__');
  const [search, setSearch] = useState('');

  const monthYms = useMemo(() => matrix.months.map(m => m.ym), [matrix.months]);
  const periods = useMemo(() => buildPeriods(monthYms, yearGran), [monthYms, yearGran]);
  const years = useMemo(() => [...new Set(monthYms.map(m => m.slice(0, 4)))], [monthYms]);

  const rows = useMemo(() => {
    let rs = matrix.rows;
    if (filterPoste !== '__all__') rs = rs.filter(r => (r.poste ?? '') === filterPoste);
    const q = search.trim().toLowerCase();
    if (q) rs = rs.filter(r => r.name.toLowerCase().includes(q));
    return rs;
  }, [matrix.rows, filterPoste, search]);

  // Totaux équipe par période
  const teamByPeriod = useMemo(() => {
    const map = new Map<string, BECapacityCell>();
    for (const per of periods) {
      let capacity = 0, reel = 0, projete = 0;
      for (const r of rows) { const a = aggCell(r.cells, per.months); capacity += a.capacity; reel += a.reel; projete += a.projete; }
      map.set(per.key, { capacity, reel, projete, ecart: capacity - projete });
    }
    return map;
  }, [rows, periods]);

  const postesPresent = useMemo(
    () => [...new Set(matrix.rows.map(r => r.poste).filter(Boolean) as string[])],
    [matrix.rows],
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Plan de charge BE" searchQuery="" onSearchChange={() => {}} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-[1600px] mx-auto space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700"><BarChart2 className="h-5 w-5" /></div>
              <div>
                <h1 className="text-xl font-display font-bold leading-none">Plan de charge — Bureau d'Études</h1>
                <p className="text-sm text-muted-foreground">Capacité vs charge projetée des missions BE · réel déclaré Lucca · détail par affaire</p>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {/* Recherche + filtre poste */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Collaborateur…" className="h-8 text-xs pl-7 w-40" />
                </div>
                <Select value={filterPoste} onValueChange={setFilterPoste}>
                  <SelectTrigger className="h-8 text-xs w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tous les postes</SelectItem>
                    {postesPresent.map(p => <SelectItem key={p} value={p}>{POSTE_LABELS[p] ?? p}</SelectItem>)}
                  </SelectContent>
                </Select>
                {/* Granularité par année */}
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="mr-1">Granularité :</span>
                  {years.map(y => {
                    const g = yearGran[y] ?? 'month';
                    return (
                      <Button key={y} variant="outline" size="sm" className="h-7 px-2 text-[11px] gap-1"
                        onClick={() => cycleYearGran(y)} title={`${y} — M/T/A`}>
                        {y.slice(2)} <span className="font-bold text-emerald-600">{GRAN_LETTER[g]}</span>
                      </Button>
                    );
                  })}
                </div>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs"
                  onClick={() => { saveView({ yearGran }); toast({ title: 'Vue enregistrée', description: 'Granularité définie comme votre standard.' }); }}
                  disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bookmark className="h-3.5 w-3.5" />}
                  Enregistrer la vue
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Réinitialiser la granularité"
                  onClick={() => { resetView(); setYearGran({}); toast({ title: 'Vue réinitialisée' }); }}>
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => refetch()} disabled={isLoading}>
                  <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />Recalculer
                </Button>
              </div>
            </div>

            {/* Légende */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              <span className="font-medium">Écart capacité − projeté :</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 inline-block" /> marge</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-50 inline-block" /> tendu</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200 inline-block" /> surcharge</span>
              <span className="ml-2">· cellule : <strong>projeté j</strong> (gros) · réel Lucca j (petit) · cliquez un collaborateur pour le détail par affaire</span>
            </div>

            <Card className="overflow-hidden">
              <CardContent className="p-0 overflow-auto max-h-[calc(100vh-230px)]">
                {isLoading ? (
                  <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                ) : rows.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">Aucun collaborateur BE ne correspond.</div>
                ) : (
                  <TooltipProvider>
                    <table className="w-full text-sm border-collapse">
                      <thead className="sticky top-0 z-20 bg-muted/40">
                        <tr className="border-b">
                          <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground sticky left-0 bg-muted/40 z-10 min-w-[230px]">Collaborateur</th>
                          {periods.map((per) => (
                            <th key={per.key} className="px-2 py-2 font-medium text-xs text-muted-foreground text-center min-w-[78px]">
                              <span className="capitalize">{per.label}</span>
                              {per.sub && <span className="block text-[8px] text-muted-foreground/70">'{per.sub}</span>}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <PersonRows
                            key={r.user_id}
                            row={r}
                            periods={periods}
                            expanded={expanded.has(r.user_id)}
                            onToggle={() => toggle(r.user_id)}
                          />
                        ))}
                        {/* Totaux équipe */}
                        <tr className="border-t-2 bg-muted/30 font-semibold">
                          <td className="px-3 py-2 sticky left-0 bg-muted/30 z-10 text-xs">Total équipe ({rows.length})</td>
                          {periods.map((per) => {
                            const c = teamByPeriod.get(per.key)!;
                            return (
                              <td key={per.key} className="px-1 py-1.5 text-center">
                                <div className={cn('rounded-md py-1 px-1', cellClass(c.ecart))}>
                                  <div className="text-xs font-semibold tabular-nums leading-none">{num(c.projete)}</div>
                                  <div className="text-[9px] opacity-70 tabular-nums">cap {num(c.capacity)}</div>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </TooltipProvider>
                )}
              </CardContent>
            </Card>

            <p className="text-[11px] text-muted-foreground">
              <strong>Capacité</strong> = jours ouvrés − fériés − congés. <strong>Projeté</strong> = tâches BE ouvertes (durée ou
              référentiel prestation), réparties au mois d'échéance. <strong>Réel</strong> = temps Lucca déclaré
              (<code>lucca_saisie_temps</code>), rapproché par <code>code_site</code> ↔ affaire. Horizon : 12 mois.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

// ---- Lignes d'un collaborateur (+ détail dépliable) ----

function PersonRows({
  row, periods, expanded, onToggle,
}: {
  row: BECapacityRow;
  periods: Period[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const totalProj = periods.reduce((s, per) => s + aggCell(row.cells, per.months).projete, 0);
  const totalReel = periods.reduce((s, per) => s + aggCell(row.cells, per.months).reel, 0);

  return (
    <>
      <tr className="border-b hover:bg-muted/20 cursor-pointer" onClick={onToggle}>
        <td className="px-3 py-1.5 sticky left-0 bg-background z-10">
          <div className="flex items-center gap-1.5">
            {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            <div>
              <div className="font-medium text-sm leading-tight">{row.name}</div>
              <div className="text-[10px] text-muted-foreground">
                {row.poste ? (POSTE_LABELS[row.poste] ?? row.poste) : '—'}
                <span className="mx-1">·</span>
                Σ proj <strong>{num(totalProj)}</strong> j · réel <strong>{num(totalReel)}</strong> j
                {row.detail.length > 0 && <span className="ml-1">· {row.detail.length} affaire(s)</span>}
              </div>
            </div>
          </div>
        </td>
        {periods.map((per) => {
          const c = aggCell(row.cells, per.months);
          if (c.capacity === 0 && c.projete === 0 && c.reel === 0) return <td key={per.key} />;
          return (
            <td key={per.key} className="px-1 py-1 text-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn('rounded-md py-1 px-1 cursor-default', cellClass(c.ecart))}>
                    <div className="text-sm font-semibold tabular-nums leading-none">{num(c.projete)}</div>
                    {c.reel > 0 && <div className="text-[9px] opacity-70 tabular-nums mt-0.5">réel {num(c.reel)}</div>}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  <div className="font-semibold mb-0.5 capitalize">{per.label} {per.sub ? `'${per.sub}` : ''}</div>
                  <div>Capacité : <strong>{num(c.capacity)} j</strong></div>
                  <div>Projeté : {num(c.projete)} j</div>
                  <div>Réel (Lucca) : {num(c.reel)} j</div>
                  <div className={c.ecart < 0 ? 'text-red-400' : 'text-emerald-400'}>Écart : {num(c.ecart)} j</div>
                </TooltipContent>
              </Tooltip>
            </td>
          );
        })}
      </tr>

      {/* Détail par affaire/projet */}
      {expanded && (row.detail.length === 0 ? (
        <tr className="border-b bg-muted/10">
          <td className="px-3 py-1.5 sticky left-0 bg-muted/10 z-10 text-[11px] text-muted-foreground italic" colSpan={periods.length + 1}>
            Aucun détail d'affaire (ni tâche affectée ni temps Lucca rapproché).
          </td>
        </tr>
      ) : row.detail.map((d) => (
        <tr key={d.key} className="border-b bg-muted/10 text-xs">
          <td className="px-3 py-1 pl-8 sticky left-0 bg-muted/10 z-10">
            <div className="font-medium leading-tight truncate max-w-[210px]" title={`${d.code} — ${d.projet}`}>{d.projet}</div>
            <div className="text-[9px] text-muted-foreground font-mono">{d.code}</div>
          </td>
          {periods.map((per) => {
            const v = aggDetail(d.byYm, per.months);
            const empty = v.projete === 0 && v.reel === 0;
            return (
              <td key={per.key} className={cn('px-1 py-1 text-center tabular-nums', empty && 'text-muted-foreground/30')}>
                {empty ? '·' : (
                  <div className="leading-tight">
                    <div className="text-[11px] font-medium text-foreground">{num(v.projete)}</div>
                    {v.reel > 0 && <div className="text-[9px] text-emerald-700">réel {num(v.reel)}</div>}
                  </div>
                )}
              </td>
            );
          })}
        </tr>
      )))}
    </>
  );
}
