/**
 * BESuivi — page « Suivi BE » (route /be/suivi).
 *
 * Vue de pilotage transverse pour le BE :
 *  - 5 cards KPI en haut
 *  - Tableau filtrable des tâches BE actives (recherche, statut, projet,
 *    assigné, retard)
 *  - Cliquer sur une ligne → ouvre la demande parente dans RequestDetailDialog
 *
 * Cible : managers BE et collaborateurs qui veulent visualiser tout le travail
 * en cours sans passer par le dispatch (orienté action).
 *
 * Chantier 4 de la roadmap MON ESPACE.
 */
import { useMemo, useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Loader2, Activity, AlertTriangle, ShieldCheck, UserX, FolderOpen,
  Search, X, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useBESuiviKpi, type BESuiviTask } from '@/hooks/useBESuiviKpi';
import { getBEStatusMeta } from '@/hooks/useBETaskStatus';
import { RequestDetailDialog } from '@/components/tasks/RequestDetailDialog';
import { supabase } from '@/integrations/supabase/client';
import type { Task } from '@/types/task';

const URGENCY_META: Record<string, { label: string; className: string }> = {
  critique: { label: '🔴 Critique', className: 'bg-red-100 text-red-700 border-red-300' },
  urgent:   { label: '🟠 Urgent',   className: 'bg-amber-100 text-amber-700 border-amber-300' },
  normal:   { label: 'Normal',       className: 'bg-slate-100 text-slate-600 border-slate-300' },
};

const ALL_BE_STATUSES = [
  'soumise', 'affectee', 'en_cours', 'a_relire', 'a_valider',
  'a_deposer', 'en_instruction', 'complement_demande', 'cloturee',
];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const sb = supabase as any;

const BESuivi = () => {
  const [activeView, setActiveView] = useState('be-suivi');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active'); // 'all' | 'active' | be_status
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { tasks, kpis, isLoading, refetch } = useBESuiviKpi();

  // Listes uniques pour les selects
  const projects = useMemo(() => {
    const map = new Map<string, { id: string; code: string; name: string }>();
    for (const t of tasks) {
      if (t.be_project) {
        map.set(t.be_project.id, {
          id: t.be_project.id,
          code: t.be_project.code_projet,
          name: t.be_project.nom_projet,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [tasks]);

  const assignees = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tasks) {
      if (t.assignee) map.set(t.assignee.id, t.assignee.display_name);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const todayStr = useMemo(() => ymd(new Date()), []);

  // Tâches filtrées
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Recherche texte
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          (t.task_number ?? '').toLowerCase().includes(q) ||
          (t.request_number ?? '').toLowerCase().includes(q) ||
          (t.title ?? '').toLowerCase().includes(q) ||
          (t.sub_process_template?.name ?? '').toLowerCase().includes(q) ||
          (t.be_project?.code_projet ?? '').toLowerCase().includes(q) ||
          (t.be_project?.nom_projet ?? '').toLowerCase().includes(q) ||
          (t.assignee?.display_name ?? '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Statut
      if (statusFilter === 'active') {
        if (t.be_status === 'cloturee') return false;
      } else if (statusFilter !== 'all') {
        if (t.be_status !== statusFilter) return false;
      }

      // Projet
      if (projectFilter !== 'all' && t.be_project_id !== projectFilter) return false;

      // Assigné
      if (assigneeFilter === 'unassigned') {
        if (t.assignee_id) return false;
      } else if (assigneeFilter !== 'all') {
        if (t.assignee_id !== assigneeFilter) return false;
      }

      // En retard
      if (overdueOnly) {
        if (!t.due_date || t.due_date >= todayStr || t.be_status === 'cloturee') return false;
      }

      return true;
    });
  }, [tasks, search, statusFilter, projectFilter, assigneeFilter, overdueOnly, todayStr]);

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('active');
    setProjectFilter('all');
    setAssigneeFilter('all');
    setOverdueOnly(false);
  };

  const activeFilterCount =
    (search.trim() ? 1 : 0) +
    (statusFilter !== 'active' ? 1 : 0) +
    (projectFilter !== 'all' ? 1 : 0) +
    (assigneeFilter !== 'all' ? 1 : 0) +
    (overdueOnly ? 1 : 0);

  // Ouvrir la demande parente d'une tâche au clic
  const openTaskDetail = async (task: BESuiviTask) => {
    if (!task.parent_request_id) return;
    const { data, error } = await sb
      .from('tasks')
      .select('*')
      .eq('id', task.parent_request_id)
      .maybeSingle();
    if (error || !data) return;
    setSelectedRequest(data as Task);
    setIsDetailOpen(true);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Suivi BE" />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6">
          <div className="space-y-6">
            {/* ── KPIs ─────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <KpiCard
                label="Prestations actives"
                value={kpis.active}
                icon={Activity}
                accent="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                onClick={() => { setStatusFilter('active'); setOverdueOnly(false); }}
              />
              <KpiCard
                label="En retard"
                value={kpis.overdue}
                icon={AlertTriangle}
                accent="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                onClick={() => { setOverdueOnly(true); setStatusFilter('active'); }}
              />
              <KpiCard
                label="À valider / relire"
                value={kpis.toValidate}
                icon={ShieldCheck}
                accent="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                onClick={() => { setStatusFilter('a_relire'); setOverdueOnly(false); }}
              />
              <KpiCard
                label="Non assignées"
                value={kpis.unassigned}
                icon={UserX}
                accent="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                onClick={() => { setAssigneeFilter('unassigned'); setStatusFilter('active'); }}
              />
              <KpiCard
                label="Projets actifs"
                value={kpis.activeProjects}
                icon={FolderOpen}
                accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              />
            </div>

            {/* ── Toolbar filtres ──────────────────────────────────────── */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Rechercher par n° de tâche, projet, prestation, assigné..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[170px] h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Toutes actives</SelectItem>
                    <SelectItem value="all">Toutes (incl. clôturées)</SelectItem>
                    {ALL_BE_STATUSES.map((s) => {
                      const meta = getBEStatusMeta(s as any);
                      return (
                        <SelectItem key={s} value={s}>
                          {meta.icon} {meta.label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger className="w-[180px] h-10">
                    <SelectValue placeholder="Projet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous projets</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="font-mono text-[10px] mr-1">{p.code}</span>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                  <SelectTrigger className="w-[170px] h-10">
                    <SelectValue placeholder="Assigné" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous assignés</SelectItem>
                    <SelectItem value="unassigned">Non assignées</SelectItem>
                    {assignees.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant={overdueOnly ? 'default' : 'outline'}
                  size="sm"
                  className="h-10 gap-2"
                  onClick={() => setOverdueOnly((v) => !v)}
                >
                  <AlertTriangle className="h-4 w-4" />
                  En retard
                </Button>

                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-10 gap-1" onClick={resetFilters}>
                    <X className="h-4 w-4" />
                    Réinitialiser
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{filteredTasks.length} tâche{filteredTasks.length !== 1 ? 's' : ''}</span>
                {activeFilterCount > 0 && <span>· {activeFilterCount} filtre{activeFilterCount > 1 ? 's' : ''} actif{activeFilterCount > 1 ? 's' : ''}</span>}
              </div>
            </div>

            {/* ── Tableau des tâches ───────────────────────────────────── */}
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
                Aucune tâche ne correspond aux filtres.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTasks.map((task) => {
                  const meta = getBEStatusMeta((task.be_status ?? 'soumise') as any);
                  const urg = (task.be_urgency ?? 'normal') as string;
                  const urgMeta = URGENCY_META[urg] ?? URGENCY_META.normal;
                  const isOverdue =
                    !!task.due_date && task.due_date < todayStr && task.be_status !== 'cloturee';

                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => openTaskDetail(task)}
                      className="w-full text-left transition-transform hover:-translate-y-0.5"
                    >
                      <Card
                        className={cn(
                          'border-border/60 hover:shadow-md hover:border-primary/40',
                          isOverdue && 'border-l-4 border-l-red-400',
                        )}
                      >
                        <CardContent className="p-3 flex items-center gap-3">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: meta.color }}
                            title={meta.label}
                          />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {task.task_number && (
                                <Badge variant="outline" className="font-mono text-[10px] px-1 py-0 shrink-0">
                                  {task.task_number}
                                </Badge>
                              )}
                              {task.be_project && (
                                <Badge variant="outline" className="font-mono text-[10px] px-1 py-0 shrink-0">
                                  {task.be_project.code_projet}
                                </Badge>
                              )}
                              <span className="text-sm font-medium truncate">
                                {task.sub_process_template?.name ?? task.title}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn('text-[10px] px-1.5 border', meta.bgClass, meta.textClass)}
                                style={{ borderColor: meta.color + '60' }}
                              >
                                {meta.icon} {meta.label}
                              </Badge>
                              {urg !== 'normal' && (
                                <Badge variant="outline" className={cn('text-[10px] px-1.5 border', urgMeta.className)}>
                                  {urgMeta.label}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                              {task.assignee ? (
                                <span>👤 {task.assignee.display_name}</span>
                              ) : (
                                <span className="text-amber-600">⚠ Non assigné</span>
                              )}
                              {task.duration_hours && <span>⏱ {task.duration_hours}h</span>}
                              {task.due_date && (
                                <span className={cn(isOverdue && 'text-red-600 font-medium')}>
                                  📅 {format(new Date(task.due_date), 'dd MMM yyyy', { locale: fr })}
                                </span>
                              )}
                            </div>
                          </div>

                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                        </CardContent>
                      </Card>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {selectedRequest && (
        <RequestDetailDialog
          task={selectedRequest}
          open={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedRequest(null);
            void refetch();
          }}
          onStatusChange={async () => { void refetch(); }}
          onTaskMutated={refetch}
        />
      )}
    </div>
  );
};

// ─── Composant interne : Card KPI ─────────────────────────────────────────────
function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  onClick?: () => void;
}) {
  const clickable = !!onClick;
  const Comp: any = clickable ? 'button' : 'div';
  return (
    <Comp
      type={clickable ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'text-left',
        clickable && 'cursor-pointer transition-transform hover:-translate-y-0.5',
      )}
    >
      <Card className={cn('border-border/60', clickable && 'hover:shadow-md hover:border-primary/30')}>
        <CardContent className="p-4 flex items-center gap-3">
          <div className={cn('p-2 rounded-lg shrink-0', accent)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className="text-2xl font-bold tabular-nums leading-tight">{value}</p>
          </div>
        </CardContent>
      </Card>
    </Comp>
  );
}

export default BESuivi;
