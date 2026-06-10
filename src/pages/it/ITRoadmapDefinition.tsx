import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ClipboardCheck, Grid3X3, X, CalendarRange, ExternalLink, Loader2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import { useFdrProjects, usePatchFdrProject, type FdrRoadmapProject } from '@/hooks/useFdrProjects';
import { totalBuildNet } from '@/lib/fdr/calculationEngine';
import { deriveHorizon, FDR_HORIZONS, HORIZON_CONFIG, type FdrHorizon } from '@/lib/fdr/horizon';
import { STATUT_PORTEFEUILLE_CONFIG, ACTIVITES_METIER } from '@/types/fdr';
import { IT_PROJECT_PILIER_CONFIG } from '@/types/itProject';
import { cn } from '@/lib/utils';

// Ordre de tri par priorité (champ priorite existant des projets IT)
const PRIORITY_ORDER: Record<string, number> = {
  critique: 0, haute: 1, normale: 2, basse: 3,
};
const priorityRank = (p?: string | null) => PRIORITY_ORDER[p ?? ''] ?? 4;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Filtre actif posé en cliquant sur une cellule de matrice. */
type MatrixFilter =
  | { kind: 'pilier'; activite: string; pilier: string }
  | { kind: 'horizon'; activite: string; horizon: FdrHorizon }
  | null;

export default function ITRoadmapDefinition() {
  const navigate = useNavigate();
  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold flex items-center gap-3">
              <div className="p-2 rounded-xl bg-violet-500/10">
                <ClipboardCheck className="h-7 w-7 text-violet-500" />
              </div>
              Définition de la feuille de route
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Cadrage par horizon : cochez/décochez pour inclure ou exclure un projet des calculs de charge.
              Cliquez sur une cellule des matrices pour filtrer la liste.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={() => navigate('/it/feuille-de-route')}>
            <CalendarRange className="h-4 w-4" />Vue Gantt
          </Button>
        </div>
        <DefinitionContent />
      </div>
    </Layout>
  );
}

function DefinitionContent() {
  const { data: projects = [], isLoading } = useFdrProjects();
  const [matrixFilter, setMatrixFilter] = useState<MatrixFilter>(null);

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <MatricesSection projects={projects} filter={matrixFilter} onFilter={setMatrixFilter} />
      <HorizonSections projects={projects} filter={matrixFilter} onClearFilter={() => setMatrixFilter(null)} />
    </div>
  );
}

// ---- Matrices ----

function MatricesSection({
  projects, filter, onFilter,
}: {
  projects: FdrRoadmapProject[];
  filter: MatrixFilter;
  onFilter: (f: MatrixFilter) => void;
}) {
  // Activités réellement utilisées (ordre du référentiel)
  const activites = useMemo(() => {
    const used = new Set(projects.map(p => p.activite_metier).filter(Boolean) as string[]);
    const ordered = ACTIVITES_METIER.filter(a => used.has(a));
    const extra = [...used].filter(a => !(ACTIVITES_METIER as readonly string[]).includes(a)).sort();
    return [...ordered, ...extra];
  }, [projects]);

  const piliers = Object.keys(IT_PROJECT_PILIER_CONFIG);

  // Comptages
  const byPilier = useMemo(() => {
    const m = new Map<string, FdrRoadmapProject[]>();
    for (const p of projects) {
      if (!p.activite_metier || !p.pilier) continue;
      const key = `${p.activite_metier}|${p.pilier}`;
      (m.get(key) ?? m.set(key, []).get(key)!).push(p);
    }
    return m;
  }, [projects]);

  const byHorizon = useMemo(() => {
    const m = new Map<string, FdrRoadmapProject[]>();
    for (const p of projects) {
      if (!p.activite_metier) continue;
      const key = `${p.activite_metier}|${deriveHorizon(p)}`;
      (m.get(key) ?? m.set(key, []).get(key)!).push(p);
    }
    return m;
  }, [projects]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Matrice Activité × Pilier */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Grid3X3 className="h-4 w-4 text-muted-foreground" />
            Matrice Activité × Pilier
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="text-xs border-collapse w-full">
            <thead>
              <tr>
                <th className="text-left font-medium text-muted-foreground px-2 py-1.5">Activité</th>
                {piliers.map(pl => (
                  <th key={pl} className="text-center font-medium px-1 py-1.5 w-14">
                    <Badge className={cn('text-[9px] border', IT_PROJECT_PILIER_CONFIG[pl as keyof typeof IT_PROJECT_PILIER_CONFIG].className)}>
                      {pl}
                    </Badge>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activites.map(a => (
                <tr key={a} className="border-t border-border/40">
                  <td className="text-left px-2 py-1 font-medium whitespace-nowrap">{a}</td>
                  {piliers.map(pl => {
                    const items = byPilier.get(`${a}|${pl}`) ?? [];
                    const active = filter?.kind === 'pilier' && filter.activite === a && filter.pilier === pl;
                    return (
                      <td key={pl} className="text-center px-1 py-1">
                        {items.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => onFilter(active ? null : { kind: 'pilier', activite: a, pilier: pl })}
                            className={cn(
                              'w-9 h-7 rounded tabular-nums font-semibold transition-colors',
                              active
                                ? 'bg-violet-600 text-white ring-2 ring-violet-300'
                                : 'bg-violet-100 text-violet-700 hover:bg-violet-200',
                            )}
                          >
                            {items.length}
                          </button>
                        ) : <span className="text-muted-foreground/30">·</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Matrice Activité × Horizon */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Grid3X3 className="h-4 w-4 text-muted-foreground" />
            Matrice Activité × Horizon
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="text-xs border-collapse w-full">
            <thead>
              <tr>
                <th className="text-left font-medium text-muted-foreground px-2 py-1.5">Activité</th>
                {FDR_HORIZONS.map(h => (
                  <th key={h} className="text-center font-medium px-1 py-1.5 whitespace-nowrap">
                    <Badge className={cn('text-[9px] border', HORIZON_CONFIG[h].className)}>{HORIZON_CONFIG[h].label}</Badge>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activites.map(a => (
                <tr key={a} className="border-t border-border/40">
                  <td className="text-left px-2 py-1 font-medium whitespace-nowrap">{a}</td>
                  {FDR_HORIZONS.map(h => {
                    const items = byHorizon.get(`${a}|${h}`) ?? [];
                    const active = filter?.kind === 'horizon' && filter.activite === a && filter.horizon === h;
                    return (
                      <td key={h} className="text-center px-1 py-1">
                        {items.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => onFilter(active ? null : { kind: 'horizon', activite: a, horizon: h })}
                            className={cn(
                              'w-9 h-7 rounded tabular-nums font-semibold transition-colors',
                              active
                                ? 'bg-violet-600 text-white ring-2 ring-violet-300'
                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200',
                            )}
                          >
                            {items.length}
                          </button>
                        ) : <span className="text-muted-foreground/30">·</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Cadrage par horizon ----

function HorizonSections({
  projects, filter, onClearFilter,
}: {
  projects: FdrRoadmapProject[];
  filter: MatrixFilter;
  onClearFilter: () => void;
}) {
  const filtered = useMemo(() => {
    if (!filter) return projects;
    return projects.filter(p => {
      if (p.activite_metier !== filter.activite) return false;
      if (filter.kind === 'pilier') return p.pilier === filter.pilier;
      return deriveHorizon(p) === filter.horizon;
    });
  }, [projects, filter]);

  const groups = useMemo(() => {
    const m = new Map<FdrHorizon, FdrRoadmapProject[]>();
    for (const h of FDR_HORIZONS) m.set(h, []);
    for (const p of filtered) m.get(deriveHorizon(p))!.push(p);
    for (const arr of m.values()) {
      arr.sort((a, b) => priorityRank(a.priorite) - priorityRank(b.priorite) || a.code.localeCompare(b.code));
    }
    return m;
  }, [filtered]);

  return (
    <div className="space-y-4">
      {filter && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 text-xs py-1 border-violet-400 bg-violet-50 text-violet-700">
            Filtre : {filter.activite} × {filter.kind === 'pilier' ? filter.pilier : HORIZON_CONFIG[filter.horizon].label}
          </Badge>
          <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={onClearFilter}>
            <X className="h-3 w-3" />Effacer
          </Button>
        </div>
      )}
      {FDR_HORIZONS.map(h => {
        const items = groups.get(h)!;
        if (items.length === 0) return null;
        return <HorizonCard key={h} horizon={h} items={items} />;
      })}
      {filtered.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucun projet ne correspond au filtre.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function HorizonCard({ horizon, items }: { horizon: FdrHorizon; items: FdrRoadmapProject[] }) {
  const navigate = useNavigate();
  const patchProject = usePatchFdrProject();
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Total de charge induite (build net + suivi) des projets INCLUS uniquement — mis à jour en direct
  const included = items.filter(p => p.sur_feuille_de_route && p.statut_portefeuille !== 'Abandonné');
  const totalBuild = round1(included.reduce((s, p) => s + totalBuildNet(p), 0));
  const totalSuivi = round1(included.reduce((s, p) => s + (p.suivi_j_mois ?? 0), 0));

  const toggle = async (p: FdrRoadmapProject) => {
    const nv = !p.sur_feuille_de_route;
    setPendingId(p.id);
    try {
      await patchProject.mutateAsync({
        projectId: p.id,
        patch: { sur_feuille_de_route: nv },
        action: nv ? 'restore_fdr' : 'remove_fdr',
        changes: [{ field: 'sur_feuille_de_route', oldValue: p.sur_feuille_de_route, newValue: nv }],
      });
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-3 text-base">
          <Badge className={cn('border', HORIZON_CONFIG[horizon].className)}>{HORIZON_CONFIG[horizon].label}</Badge>
          <span className="text-sm font-normal text-muted-foreground">
            {included.length}/{items.length} inclus
          </span>
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            Charge induite : <strong className="text-foreground tabular-nums">{totalBuild} j/mois build</strong>
            {totalSuivi > 0 && <> + <strong className="text-foreground tabular-nums">{totalSuivi} j/mois suivi</strong></>}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-[44px] text-center">FDR</TableHead>
                <TableHead>Projet</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Priorité</TableHead>
                <TableHead>Activité</TableHead>
                <TableHead>Pilier</TableHead>
                <TableHead className="text-right">Build (j/m)</TableHead>
                <TableHead className="text-right">Suivi (j/m)</TableHead>
                <TableHead className="w-[44px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(p => {
                const excluded = !p.sur_feuille_de_route;
                const statutCfg = STATUT_PORTEFEUILLE_CONFIG[p.statut_portefeuille];
                return (
                  <TableRow key={p.id} className={cn(excluded && 'opacity-40')}>
                    <TableCell className="text-center">
                      {pendingId === p.id
                        ? <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                        : <Checkbox
                            checked={p.sur_feuille_de_route}
                            disabled={p.statut_portefeuille === 'Abandonné'}
                            onCheckedChange={() => toggle(p)}
                          />}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-[10px] text-muted-foreground mr-1.5">{p.code}</span>
                      <span className="text-sm">{p.nom}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('text-[10px] border', statutCfg?.className)}>{p.statut_portefeuille}</Badge>
                    </TableCell>
                    <TableCell className="text-xs capitalize">{p.priorite ?? '—'}</TableCell>
                    <TableCell className="text-xs">{p.activite_metier ?? '—'}</TableCell>
                    <TableCell>
                      {p.pilier
                        ? <Badge className={cn('text-[9px] border', IT_PROJECT_PILIER_CONFIG[p.pilier as keyof typeof IT_PROJECT_PILIER_CONFIG]?.className)}>{p.pilier}</Badge>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{round1(totalBuildNet(p))}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{p.suivi_j_mois || '—'}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => navigate(`/it/projects/${encodeURIComponent(p.code)}/overview`)}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
