import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Gauge, AlertTriangle, Rocket, CalendarRange, ExternalLink, TrendingUp,
} from 'lucide-react';
import { useFdrProjects, type FdrRoadmapProject } from '@/hooks/useFdrProjects';
import { getMepRetenue, toYM, cmpYM } from '@/lib/fdr/calculationEngine';
import { STATUT_PORTEFEUILLE_CONFIG } from '@/types/fdr';
import { IT_PROJECT_PILIER_CONFIG } from '@/types/itProject';
import { cn } from '@/lib/utils';

const round = (n: number) => Math.round(n);

function fmtYM(ym: string): string {
  const [y, m] = ym.split('-');
  const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

/** Détection des retards par rapport au plan (sans historique : comparaison plan vs statut réel). */
function detectDelay(p: FdrRoadmapProject, nowYM: string): string | null {
  if (!p.sur_feuille_de_route || p.statut_portefeuille === 'Abandonné') return null;
  if (p.statut_portefeuille === 'Tâche permanente') return null;

  const kickoff = toYM(p.date_kickoff);
  const mep = getMepRetenue(p);

  // MEP planifiée dépassée mais projet pas déployé
  if (mep && cmpYM(mep, nowYM) < 0 && p.statut_portefeuille !== 'Déployé') {
    return `MEP planifiée ${fmtYM(mep)} dépassée`;
  }
  // Kickoff passé mais projet toujours à l'état d'idée / proposition
  if (kickoff && cmpYM(kickoff, nowYM) < 0 &&
      (p.statut_portefeuille === 'Idée' || p.statut_portefeuille === 'Proposition')) {
    return `Kickoff ${fmtYM(kickoff)} passé, projet non démarré`;
  }
  return null;
}

export default function ITRoadmapTracking() {
  const navigate = useNavigate();
  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold flex items-center gap-3">
              <div className="p-2 rounded-xl bg-violet-500/10">
                <Gauge className="h-7 w-7 text-violet-500" />
              </div>
              Suivi d'avancement — Feuille de route
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Avancement par activité et pilier, projets en retard sur le plan, prochaines mises en production.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={() => navigate('/it/feuille-de-route')}>
            <CalendarRange className="h-4 w-4" />Vue Gantt
          </Button>
        </div>
        <TrackingContent />
      </div>
    </Layout>
  );
}

function TrackingContent() {
  const { data: projects = [], isLoading } = useFdrProjects();
  const navigate = useNavigate();

  const now = new Date();
  const nowYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  // Fenêtre "prochaines MEP" : 90 jours ≈ 3 mois
  const horizonMep = `${now.getFullYear()}-${String(now.getMonth() + 4).padStart(2, '0')}`;

  const active = useMemo(
    () => projects.filter(p => p.sur_feuille_de_route && p.statut_portefeuille !== 'Abandonné'),
    [projects],
  );

  const avgGlobal = useMemo(() => {
    const arr = active.filter(p => p.statut_portefeuille !== 'Tâche permanente');
    if (arr.length === 0) return 0;
    return arr.reduce((s, p) => s + (p.pct_avancement ?? 0), 0) / arr.length;
  }, [active]);

  const byActivite = useMemo(() => groupAvg(active, p => p.activite_metier ?? '— Sans activité —'), [active]);
  const byPilier = useMemo(() => groupAvg(active, p => p.pilier ?? '— Sans pilier —'), [active]);

  const delayed = useMemo(() =>
    active
      .map(p => ({ p, reason: detectDelay(p, nowYM) }))
      .filter((x): x is { p: FdrRoadmapProject; reason: string } => x.reason != null),
    [active, nowYM]);

  const upcomingMep = useMemo(() =>
    active
      .map(p => ({ p, mep: getMepRetenue(p) }))
      .filter((x): x is { p: FdrRoadmapProject; mep: string } =>
        x.mep != null && cmpYM(x.mep, nowYM) >= 0 && cmpYM(x.mep, horizonMep) <= 0 &&
        x.p.statut_portefeuille !== 'Déployé' && x.p.statut_portefeuille !== 'Tâche permanente')
      .sort((a, b) => cmpYM(a.mep, b.mep)),
    [active, nowYM, horizonMep]);

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<TrendingUp className="h-4 w-4 text-violet-500" />} label="Avancement moyen"
          value={`${round(avgGlobal)} %`} />
        <KpiCard icon={<Gauge className="h-4 w-4 text-blue-500" />} label="Projets actifs FDR"
          value={String(active.length)} />
        <KpiCard icon={<AlertTriangle className="h-4 w-4 text-red-500" />} label="Projets en retard"
          value={String(delayed.length)} alert={delayed.length > 0} />
        <KpiCard icon={<Rocket className="h-4 w-4 text-emerald-500" />} label="MEP sous 90 jours"
          value={String(upcomingMep.length)} />
      </div>

      {/* Avancement par activité / pilier */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <AvgCard title="Avancement moyen par activité" rows={byActivite} />
        <AvgCard title="Avancement moyen par pilier" rows={byPilier} renderLabel={label =>
          IT_PROJECT_PILIER_CONFIG[label as keyof typeof IT_PROJECT_PILIER_CONFIG]
            ? <span className="flex items-center gap-2">
                <Badge className={cn('text-[9px] border', IT_PROJECT_PILIER_CONFIG[label as keyof typeof IT_PROJECT_PILIER_CONFIG].className)}>{label}</Badge>
                {IT_PROJECT_PILIER_CONFIG[label as keyof typeof IT_PROJECT_PILIER_CONFIG].label}
              </span>
            : label
        } />
      </div>

      {/* Projets en retard */}
      <Card className={cn('border-border/50', delayed.length > 0 && 'border-red-200')}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className={cn('h-4 w-4', delayed.length > 0 ? 'text-red-500' : 'text-muted-foreground')} />
            Projets en retard sur le plan
            <Badge variant={delayed.length > 0 ? 'outline' : 'secondary'}
              className={cn('text-xs', delayed.length > 0 && 'border-red-300 text-red-700 bg-red-50')}>
              {delayed.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {delayed.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">✅ Aucun projet en retard détecté.</p>
          ) : (
            <ProjectTable
              rows={delayed.map(({ p, reason }) => ({ p, extra: reason }))}
              extraHeader="Retard détecté"
              extraClass="text-red-700"
              onOpen={p => navigate(`/it/projects/${encodeURIComponent(p.code)}/overview`)}
            />
          )}
        </CardContent>
      </Card>

      {/* Prochaines MEP */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Rocket className="h-4 w-4 text-emerald-500" />
            Prochaines mises en production (90 jours)
            <Badge variant="secondary" className="text-xs">{upcomingMep.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingMep.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Aucune MEP planifiée sous 90 jours.</p>
          ) : (
            <ProjectTable
              rows={upcomingMep.map(({ p, mep }) => ({ p, extra: fmtYM(mep) }))}
              extraHeader="MEP retenue"
              extraClass="text-emerald-700 font-medium"
              onOpen={p => navigate(`/it/projects/${encodeURIComponent(p.code)}/overview`)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Helpers ----

function groupAvg(projects: FdrRoadmapProject[], keyFn: (p: FdrRoadmapProject) => string) {
  const m = new Map<string, { sum: number; n: number }>();
  for (const p of projects) {
    if (p.statut_portefeuille === 'Tâche permanente') continue;
    const k = keyFn(p);
    const e = m.get(k) ?? { sum: 0, n: 0 };
    e.sum += p.pct_avancement ?? 0;
    e.n += 1;
    m.set(k, e);
  }
  return [...m.entries()]
    .map(([label, { sum, n }]) => ({ label, avg: sum / n, count: n }))
    .sort((a, b) => b.avg - a.avg);
}

function KpiCard({ icon, label, value, alert }: { icon: React.ReactNode; label: string; value: string; alert?: boolean }) {
  return (
    <Card className={cn('border-border/50', alert && 'border-red-200 bg-red-50/40')}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <div className={cn('text-2xl font-bold mt-1 tabular-nums', alert && 'text-red-700')}>{value}</div>
      </CardContent>
    </Card>
  );
}

function AvgCard({ title, rows, renderLabel }: {
  title: string;
  rows: Array<{ label: string; avg: number; count: number }>;
  renderLabel?: (label: string) => React.ReactNode;
}) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {rows.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Aucune donnée.</p>}
        {rows.map(r => (
          <div key={r.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{renderLabel ? renderLabel(r.label) : r.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {round(r.avg)} % <span className="text-[10px]">({r.count} projet{r.count > 1 ? 's' : ''})</span>
              </span>
            </div>
            <Progress value={r.avg} className="h-1.5" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ProjectTable({ rows, extraHeader, extraClass, onOpen }: {
  rows: Array<{ p: FdrRoadmapProject; extra: string }>;
  extraHeader: string;
  extraClass?: string;
  onOpen: (p: FdrRoadmapProject) => void;
}) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead>Projet</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Avancement</TableHead>
            <TableHead>{extraHeader}</TableHead>
            <TableHead className="w-[44px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ p, extra }) => {
            const statutCfg = STATUT_PORTEFEUILLE_CONFIG[p.statut_portefeuille];
            return (
              <TableRow key={p.id}>
                <TableCell>
                  <span className="font-mono text-[10px] text-muted-foreground mr-1.5">{p.code}</span>
                  <span className="text-sm">{p.nom}</span>
                </TableCell>
                <TableCell>
                  <Badge className={cn('text-[10px] border', statutCfg?.className)}>{p.statut_portefeuille}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Progress value={p.pct_avancement ?? 0} className="h-1.5 w-16" />
                    <span className="tabular-nums text-xs w-9 text-right">{round(p.pct_avancement ?? 0)} %</span>
                  </div>
                </TableCell>
                <TableCell className={cn('text-xs', extraClass)}>{extra}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpen(p)}>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
