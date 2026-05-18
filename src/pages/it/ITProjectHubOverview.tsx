/**
 * ITProjectHubOverview — Page synthèse simplifiée d'un projet IT.
 *
 * Affiche uniquement :
 *  1. Carte « Synthèse d'avancement » (taux global + répartition tâches + budget)
 *  2. Phase courante du projet
 *  3. Planning : dates clés + jalons
 *
 * Toute la configuration fine (FDR, gestion détaillée des phases,
 * Microsoft 365, fiche projet complète) est accessible via les autres onglets
 * du hub projet.
 */
import { useMemo } from 'react';
import { useITProjectHubCode } from '@/hooks/useITProjectHubCode';
import { Layout } from '@/components/layout/Layout';
import { ITProjectHubHeader } from '@/components/it/ITProjectHubHeader';
import {
  useITProject,
  useITProjectTasks,
  useITProjectStats,
  useITProjectMilestones,
  useITProjectPhaseProgress,
} from '@/hooks/useITProjectHub';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Calendar, TrendingUp, Target, Euro, Flag, CalendarRange,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  IT_PHASE_BADGE_CONFIG, ITProjectPhase, getActivePhases,
} from '@/types/itProject';

export default function ITProjectHubOverview() {
  const code = useITProjectHubCode();
  const { data: project, isLoading } = useITProject(code);
  const { data: tasks = [] } = useITProjectTasks(project?.id);
  const { data: milestones = [] } = useITProjectMilestones(project?.id);
  const stats = useITProjectStats(tasks, project);
  const { data: phaseProgressMap = new Map() } = useITProjectPhaseProgress(project?.id);

  const activePhases = useMemo(
    () => getActivePhases(project?.phases_actives as ITProjectPhase[] | null | undefined),
    [project?.phases_actives],
  );

  const phaseProgressValues = useMemo(() => {
    const values: Record<string, number> = {};
    for (const phase of activePhases) {
      const record = phaseProgressMap.get(phase.value);
      if (record && record.advancement_mode === 'manual' && record.manual_progress != null) {
        values[phase.value] = record.manual_progress;
      } else {
        const phaseTasks = tasks.filter(t => t.it_project_phase === phase.value);
        const total = phaseTasks.length;
        const done = phaseTasks.filter(t => ['done', 'validated', 'closed'].includes(t.status)).length;
        values[phase.value] = total > 0 ? Math.round((done / total) * 100) : 0;
      }
    }
    return values;
  }, [tasks, phaseProgressMap, activePhases]);

  const globalProgress = useMemo(() => {
    if (activePhases.length === 0) return 0;
    const sum = activePhases.reduce((acc, p) => acc + (phaseProgressValues[p.value] || 0), 0);
    return Math.round(sum / activePhases.length);
  }, [phaseProgressValues, activePhases]);

  // Planning : tri des jalons par date prévue (hook avant tout early-return)
  const sortedMilestones = useMemo(
    () => [...milestones].sort((a, b) => {
      if (!a.date_prevue) return 1;
      if (!b.date_prevue) return -1;
      return new Date(a.date_prevue).getTime() - new Date(b.date_prevue).getTime();
    }),
    [milestones],
  );

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
        </div>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Projet non trouvé
        </div>
      </Layout>
    );
  }

  const currentPhase = activePhases.find(p => p.value === project.phase_courante);
  const currentPhaseProgress = currentPhase ? phaseProgressValues[currentPhase.value] ?? 0 : 0;
  const phaseBadge = currentPhase ? IT_PHASE_BADGE_CONFIG[currentPhase.value as ITProjectPhase] : null;

  // Calcul du temps restant
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dDay = project.date_fin_prevue
    ? differenceInDays(parseISO(project.date_fin_prevue as unknown as string), today)
    : null;

  return (
    <Layout>
      <div className="flex flex-col h-full">
        <ITProjectHubHeader project={project} stats={stats} />

        <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4 max-w-4xl mx-auto w-full">

          {/* ───────────── 1. Synthèse d'avancement ───────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-violet-600" />
                Synthèse d'avancement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Taux global */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Avancement global
                  </span>
                  <span className="text-3xl font-bold text-violet-600 tabular-nums">
                    {globalProgress}%
                  </span>
                </div>
                <Progress value={globalProgress} className="h-3" />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Moyenne pondérée sur {activePhases.length} phase{activePhases.length > 1 ? 's' : ''} active{activePhases.length > 1 ? 's' : ''}
                </p>
              </div>

              {/* Répartition tâches */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-950/30 border">
                  <p className="text-2xl font-bold">{stats.openTasks}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">À faire</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100">
                  <p className="text-2xl font-bold text-blue-600">
                    {stats.totalTasks - stats.openTasks - stats.doneTasks}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">En cours</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100">
                  <p className="text-2xl font-bold text-emerald-600">{stats.doneTasks}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Terminées</p>
                </div>
              </div>

              {/* Budget (si défini) */}
              {project.budget_previsionnel && (
                <div className="pt-3 border-t">
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Euro className="h-3.5 w-3.5" /> Budget consommé
                    </span>
                    <span className="text-sm font-semibold tabular-nums">
                      {(project.budget_consomme || 0).toLocaleString('fr-FR')} €
                      <span className="text-muted-foreground font-normal">
                        {' / '}{project.budget_previsionnel.toLocaleString('fr-FR')} €
                      </span>
                    </span>
                  </div>
                  <Progress
                    value={stats.budgetRatio || 0}
                    className={cn('h-2', stats.budgetRatio && stats.budgetRatio > 90 ? 'text-red-500' : '')}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* ───────────── 2. Phase en cours ───────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-violet-600" />
                Phase en cours
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentPhase ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    {phaseBadge && (
                      <Badge className={cn(phaseBadge.className, 'border text-sm px-2.5 py-1')}>
                        {phaseBadge.icon} {currentPhase.label}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Phase {currentPhase.order} / {activePhases.length}
                    </span>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs text-muted-foreground">Avancement de la phase</span>
                      <span className="text-sm font-semibold text-violet-600 tabular-nums">{currentPhaseProgress}%</span>
                    </div>
                    <Progress value={currentPhaseProgress} className="h-2" />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Aucune phase courante définie pour ce projet.
                </p>
              )}
            </CardContent>
          </Card>

          {/* ───────────── 3. Planning ───────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CalendarRange className="h-4 w-4 text-violet-600" />
                Planning
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Dates clés */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <DateTile
                  label="Début"
                  date={project.date_debut as unknown as string | null}
                />
                <DateTile
                  label="Fin prévue"
                  date={project.date_fin_prevue as unknown as string | null}
                />
                <div className="rounded-lg border bg-violet-50/40 dark:bg-violet-950/20 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Délai restant</p>
                  <p className="text-sm font-semibold mt-1">
                    {dDay === null ? '—' : dDay < 0 ? (
                      <span className="text-red-600">+{Math.abs(dDay)} j de retard</span>
                    ) : dDay === 0 ? (
                      <span className="text-amber-600">Aujourd'hui</span>
                    ) : (
                      <span className="text-violet-700">J–{dDay}</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Jalons */}
              <div className="pt-2 border-t">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Flag className="h-3 w-3" /> Jalons ({sortedMilestones.length})
                </h4>
                {sortedMilestones.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Aucun jalon défini.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {sortedMilestones.map((m) => {
                      const statusMap: Record<string, { label: string; cls: string }> = {
                        a_venir:  { label: 'À venir',  cls: 'bg-slate-100 text-slate-700' },
                        en_cours: { label: 'En cours', cls: 'bg-blue-100 text-blue-700' },
                        termine:  { label: 'Terminé',  cls: 'bg-emerald-100 text-emerald-700' },
                        retarde:  { label: 'En retard',cls: 'bg-red-100 text-red-700' },
                      };
                      const s = statusMap[m.statut] || statusMap.a_venir;
                      return (
                        <li key={m.id} className="flex items-center gap-2 text-sm">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="flex-1 truncate">{m.titre}</span>
                          {m.date_prevue && (
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {format(new Date(m.date_prevue), 'dd MMM yyyy', { locale: fr })}
                            </span>
                          )}
                          <Badge className={cn('text-[10px] border-0', s.cls)}>{s.label}</Badge>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </Layout>
  );
}

function DateTile({ label, date }: { label: string; date: string | null | undefined }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold mt-1 tabular-nums">
        {date ? format(new Date(date), 'dd MMM yyyy', { locale: fr }) : '—'}
      </p>
    </div>
  );
}
