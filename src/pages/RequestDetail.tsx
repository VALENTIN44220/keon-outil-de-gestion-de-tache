/**
 * RequestDetail — Page plein écran « Détail demande ».
 *
 * Designed comme un portail de suivi (style commande client) :
 *  - Hero card avec numéro + statut visuel + progression
 *  - Stepper visuel des étapes en timeline verticale
 *  - Cartes propres avec hiérarchie typographique forte
 *  - Pensé responsive pour devenir un portail public si besoin
 *
 * Typographie unifiée :
 *   h1 hero      : text-3xl sm:text-4xl font-bold tracking-tight
 *   Card title   : text-base font-semibold
 *   Labels       : text-[11px] font-medium uppercase tracking-wider text-muted-foreground
 *   Body         : text-sm leading-relaxed
 *   Meta         : text-xs text-muted-foreground
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatchedRouteParam } from '@/hooks/useMatchedRouteParam';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  ArrowLeft, Calendar, CheckCircle2, ChevronRight, Clock,
  Flag, ListChecks, MessageSquare, User, Workflow, AlertTriangle,
  ShieldCheck, FileText, Loader2, Ban, UserPlus, Hourglass, Sparkles,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Task } from '@/types/task';
import { cn } from '@/lib/utils';
import { TaskCommentsSection } from '@/components/tasks/TaskCommentsSection';
import { getBEStatusMeta } from '@/hooks/useBETaskStatus';
import { useRequestStates, macroStateColor } from '@/hooks/useRequestStates';
import { toast } from 'sonner';

// ─── Métadonnées statut ─────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; chip: string; dot: string }> = {
  to_assign:            { label: 'À affecter',       chip: 'bg-slate-100 text-slate-700',    dot: 'bg-slate-400' },
  todo:                 { label: 'À faire',          chip: 'bg-blue-100 text-blue-700',      dot: 'bg-blue-500' },
  'in-progress':        { label: 'En cours',         chip: 'bg-amber-100 text-amber-700',    dot: 'bg-amber-500' },
  pending_validation_1: { label: 'Validation N1',    chip: 'bg-violet-100 text-violet-700',  dot: 'bg-violet-500' },
  pending_validation_2: { label: 'Validation N2',    chip: 'bg-violet-100 text-violet-700',  dot: 'bg-violet-500' },
  done:                 { label: 'Terminé',          chip: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  validated:            { label: 'Validé',           chip: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  cancelled:            { label: 'Annulé',           chip: 'bg-red-100 text-red-700',        dot: 'bg-red-500' },
  refused:              { label: 'Refusé',           chip: 'bg-red-100 text-red-700',        dot: 'bg-red-500' },
};

const PRIORITY_META: Record<string, { label: string; chip: string }> = {
  low:    { label: 'Faible',  chip: 'bg-slate-100 text-slate-700 border-slate-200' },
  medium: { label: 'Normale', chip: 'bg-blue-100 text-blue-700 border-blue-200' },
  high:   { label: 'Élevée',  chip: 'bg-amber-100 text-amber-700 border-amber-200' },
  urgent: { label: 'Urgente', chip: 'bg-red-100 text-red-700 border-red-200' },
};

interface SubProcessGroup {
  subProcessId: string;
  subProcessName: string;
  tasks: Task[];
  progressPercent: number;
  done: number;
  total: number;
}

// ════════════════════════════════════════════════════════════════════════
export default function RequestDetail() {
  const taskId = useMatchedRouteParam('taskId', '/demande/:taskId');
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { isAdmin } = useUserRole();

  const [activeView, setActiveView] = useState('requests');
  const [activeTab, setActiveTab] = useState<'steps' | 'synthesis'>('steps');

  const [task, setTask] = useState<Task | null>(null);
  const [childTasks, setChildTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());
  const [subProcessNames, setSubProcessNames] = useState<Map<string, string>>(new Map());
  const [processName, setProcessName] = useState<string | null>(null);
  const [requesterDetails, setRequesterDetails] = useState<{ company: string | null; department: string | null; job_title: string | null } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);

  // États métier (request_states) du processus de la demande
  const { statesByCode: reqStatesByCode, labelOf: reqStateLabelOf } = useRequestStates(
    (task as any)?.source_process_template_id ?? null,
  );

  // ─── Fetch ──────────────────────────────────────────────────────
  useEffect(() => { if (taskId) void load(); }, [taskId]); // eslint-disable-line

  const load = async () => {
    if (!taskId) return;
    setIsLoading(true);
    try {
      const { data: t, error } = await supabase
        .from('tasks').select('*').eq('id', taskId).single();
      if (error) throw error;
      if (!t) { navigate(-1); return; }
      setTask(t as Task);

      const { data: kids } = await supabase
        .from('tasks').select('*').eq('parent_request_id', taskId).order('created_at');
      setChildTasks((kids || []) as Task[]);

      if ((t as any).source_process_template_id) {
        const { data: pData } = await supabase
          .from('process_templates').select('name')
          .eq('id', (t as any).source_process_template_id).maybeSingle();
        if (pData) setProcessName(pData.name);
      }

      const spIds = Array.from(new Set(
        (kids || [])
          .map((c: any) => c.sub_process_template_id || c.source_sub_process_template_id)
          .filter(Boolean),
      ));
      if (spIds.length > 0) {
        const { data: spData } = await supabase
          .from('sub_process_templates').select('id, name').in('id', spIds);
        const map = new Map<string, string>();
        for (const sp of (spData || [])) map.set(sp.id, sp.name);
        setSubProcessNames(map);
      }

      const allProfileIds = new Set<string>();
      if ((t as any).requester_id) allProfileIds.add((t as any).requester_id);
      if ((t as any).assignee_id) allProfileIds.add((t as any).assignee_id);
      for (const c of (kids || [])) {
        if ((c as any).assignee_id) allProfileIds.add((c as any).assignee_id);
        if ((c as any).validator_level_1_id) allProfileIds.add((c as any).validator_level_1_id);
        if ((c as any).validator_level_2_id) allProfileIds.add((c as any).validator_level_2_id);
      }
      if (allProfileIds.size > 0) {
        const { data: profs } = await supabase
          .from('profiles').select('id, display_name, company:companies(name), department:departments(name), job_title')
          .in('id', Array.from(allProfileIds));
        const map = new Map<string, string>();
        for (const p of (profs || []) as any[]) map.set(p.id, p.display_name || 'Sans nom');
        setProfiles(map);
        if ((t as any).requester_id) {
          const req = (profs || []).find((p: any) => p.id === (t as any).requester_id) as any;
          if (req) setRequesterDetails({
            company: req.company?.name ?? null,
            department: req.department?.name ?? null,
            job_title: req.job_title ?? null,
          });
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Erreur de chargement');
      navigate(-1);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Calculs ───────────────────────────────────────────────────
  const subProcessGroups = useMemo<SubProcessGroup[]>(() => {
    const groups = new Map<string, Task[]>();
    for (const c of childTasks) {
      const id = (c as any).sub_process_template_id || (c as any).source_sub_process_template_id || '__direct__';
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id)!.push(c);
    }
    return Array.from(groups.entries())
      .filter(([id]) => id !== '__direct__')
      .map(([id, tasks]) => {
        const done = tasks.filter(t =>
          ['done', 'validated'].includes(t.status as string) ||
          (t as any).be_status === 'cloturee'
        ).length;
        return {
          subProcessId: id,
          subProcessName: subProcessNames.get(id) ?? 'Sous-processus',
          tasks,
          done,
          total: tasks.length,
          progressPercent: tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100),
        };
      });
  }, [childTasks, subProcessNames]);

  const globalProgress = useMemo(() => {
    if (childTasks.length === 0) return 0;
    const done = childTasks.filter(t =>
      ['done', 'validated'].includes(t.status as string) ||
      (t as any).be_status === 'cloturee'
    ).length;
    return Math.round((done / childTasks.length) * 100);
  }, [childTasks]);

  // ─── Actions ──────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!task) return;
    if (!window.confirm('Annuler définitivement cette demande ? Toutes les tâches enfant seront également annulées.')) return;
    setIsCancelling(true);
    const now = new Date().toISOString();
    // 1) Annule toutes les tâches enfant non terminées (pour qu'elles sortent du dispatch BE / des plans de charge)
    const activeChildIds = childTasks
      .filter((c) => c.status !== 'cancelled' && c.status !== 'done' && c.status !== 'validated')
      .map((c) => c.id);
    if (activeChildIds.length > 0) {
      const { error: childErr } = await supabase
        .from('tasks')
        .update({ status: 'cancelled', updated_at: now })
        .in('id', activeChildIds);
      if (childErr) {
        setIsCancelling(false);
        toast.error(`Erreur annulation tâches : ${childErr.message}`);
        return;
      }
    }
    // 2) Annule la demande elle-même
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'cancelled', updated_at: now })
      .eq('id', task.id);
    setIsCancelling(false);
    if (error) { toast.error(`Erreur : ${error.message}`); return; }
    toast.success(activeChildIds.length > 0
      ? `Demande annulée (${activeChildIds.length} tâche${activeChildIds.length > 1 ? 's' : ''} enfant également annulée${activeChildIds.length > 1 ? 's' : ''})`
      : 'Demande annulée');
    navigate(-1);
  };

  // ─── Loading ──────────────────────────────────────────────────
  if (isLoading || !task) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar activeView={activeView} onViewChange={setActiveView} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-4">
            <Skeleton className="h-32 w-full max-w-5xl mx-auto" />
            <Skeleton className="h-96 w-full max-w-5xl mx-auto" />
          </main>
        </div>
      </div>
    );
  }

  const statusMeta = STATUS_META[task.status as string] ?? STATUS_META.todo;
  const prioMeta = PRIORITY_META[task.priority as string] ?? PRIORITY_META.medium;
  const dueDate = (task as any).due_date as string | null | undefined;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dueOverdue = dueDate ? new Date(dueDate) < today && !['done', 'validated', 'cancelled'].includes(task.status as string) : false;
  const dueIn = dueDate ? differenceInDays(new Date(dueDate), today) : null;
  const canCancel = !['done', 'validated', 'cancelled'].includes(task.status as string)
    && (isAdmin || task.requester_id === profile?.id);

  // Total tâches terminées
  const totalDone = childTasks.filter(t =>
    ['done', 'validated'].includes(t.status as string) || (t as any).be_status === 'cloturee'
  ).length;

  // Détermine l'étape "courante" pour afficher dans le hero
  const currentStep = childTasks.find(t =>
    !['done', 'validated', 'cancelled'].includes(t.status as string) && (t as any).be_status !== 'cloturee'
  );

  return (
    <div className="flex h-screen">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto min-w-0 bg-gradient-to-br from-slate-100/70 via-blue-50/40 to-slate-50/60">
          <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4 pb-12">

            {/* ── Breadcrumb ──────────────────────────────────── */}
            <button
              onClick={() => navigate(-1)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Retour
            </button>

            {/* ─────────────────────────────────────────────────── */}
            {/* HERO CARD                                          */}
            {/* ─────────────────────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-2xl border bg-card shadow-sm">
              {/* Bandeau dégradé selon priorité */}
              <div className={cn(
                'absolute inset-x-0 top-0 h-1',
                task.priority === 'urgent' && 'bg-red-500',
                task.priority === 'high' && 'bg-amber-500',
                task.priority === 'medium' && 'bg-blue-500',
                task.priority === 'low' && 'bg-slate-300',
              )} />

              <div className="p-4 sm:p-5 space-y-3">
                {/* Numéro + chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  {task.request_number && (
                    <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted px-2 py-1 rounded">
                      {task.request_number}
                    </span>
                  )}
                  <Badge className={cn('text-[10px] font-medium px-2 py-0.5 border', prioMeta.chip)}>
                    <Flag className="h-2.5 w-2.5 mr-1" />
                    {prioMeta.label}
                  </Badge>
                  <Badge className={cn('text-[10px] font-medium px-2 py-0.5 border-0 gap-1.5', statusMeta.chip)}>
                    <span className={cn('inline-block w-1.5 h-1.5 rounded-full', statusMeta.dot)} />
                    {statusMeta.label}
                  </Badge>
                  {processName && (
                    <Badge variant="outline" className="text-[10px] font-medium px-2 py-0.5 gap-1 text-muted-foreground border-dashed">
                      <Workflow className="h-2.5 w-2.5" />
                      {processName}
                    </Badge>
                  )}
                  {(task as any).current_state_code && (() => {
                    const code = (task as any).current_state_code as string;
                    const st = reqStatesByCode.get(code);
                    const macro = st?.state_category ?? null;
                    return (
                      <Badge
                        className={cn(
                          'text-[10px] font-medium px-2 py-0.5 border-0',
                          macro ? macroStateColor(macro) : 'bg-slate-100 text-slate-700',
                        )}
                        title={`État métier : ${st?.label ?? code}`}
                      >
                        {reqStateLabelOf(code)}
                      </Badge>
                    );
                  })()}
                </div>

                {/* Titre */}
                <h1 className="text-lg sm:text-xl font-bold tracking-tight leading-tight">
                  {(task.title ?? '').replace(/^([TD]-[A-Z][A-Z0-9-]*\d+\s*—\s*)+/, '')}
                </h1>

                {/* Méta créée + échéance */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Créée le {format(parseISO((task as any).created_at), 'd MMMM yyyy', { locale: fr })}
                  </span>
                  {dueDate && (
                    <span className={cn(
                      'flex items-center gap-1.5',
                      dueOverdue ? 'text-red-600 font-semibold' : dueIn !== null && dueIn <= 7 ? 'text-amber-700 font-medium' : ''
                    )}>
                      <Clock className="h-3.5 w-3.5" />
                      {dueOverdue
                        ? `En retard de ${Math.abs(dueIn ?? 0)} j`
                        : dueIn === 0 ? 'Échéance aujourd\'hui'
                        : dueIn !== null && dueIn > 0 ? `J–${dueIn}` : ''}
                      <span className="text-muted-foreground font-normal ml-1">
                        ({format(parseISO(dueDate), 'd MMM yyyy', { locale: fr })})
                      </span>
                    </span>
                  )}
                </div>

                {/* Progress bar compacte */}
                <div className="pt-1">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Avancement
                    </span>
                    <span className="text-xl font-bold tracking-tight tabular-nums bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
                      {globalProgress}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-500"
                      style={{ width: `${globalProgress}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{totalDone}</span>
                      {' / '}{childTasks.length} étape{childTasks.length > 1 ? 's' : ''} terminée{totalDone > 1 ? 's' : ''}
                    </span>
                    {currentStep && (
                      <span className="text-muted-foreground flex items-center gap-1 truncate ml-2">
                        <Hourglass className="h-3 w-3 shrink-0" />
                        En cours : <span className="font-medium text-foreground truncate">{stripPrefix(currentStep.title)}</span>
                      </span>
                    )}
                    {!currentStep && globalProgress === 100 && (
                      <span className="text-emerald-700 flex items-center gap-1 font-medium">
                        <Sparkles className="h-3 w-3" />
                        Demande complète
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────── */}
            {/* TABS                                                */}
            {/* ─────────────────────────────────────────────────── */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="bg-white/70 border border-blue-200/50 h-10 p-1 shadow-sm">
                <TabsTrigger value="steps" className="gap-2 text-sm px-4 h-8 data-[state=active]:shadow-sm">
                  <ListChecks className="h-4 w-4" />
                  <span>Étapes</span>
                  {childTasks.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                      {totalDone}/{childTasks.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="synthesis" className="gap-2 text-sm px-4 h-8 data-[state=active]:shadow-sm">
                  <FileText className="h-4 w-4" />
                  <span>Synthèse</span>
                </TabsTrigger>
              </TabsList>

              {/* ═════ ÉTAPES ═════ */}
              <TabsContent value="steps" className="mt-5 space-y-5">
                {childTasks.length === 0 ? (
                  <Card className="border-dashed border-2 border-blue-200/70 bg-blue-50/30">
                    <CardContent className="p-16 text-center text-sm text-muted-foreground">
                      <FileText className="h-10 w-10 mx-auto opacity-40 mb-3 text-blue-400" />
                      Aucune étape pour cette demande.
                    </CardContent>
                  </Card>
                ) : subProcessGroups.length === 0 ? (
                  <Card className="overflow-hidden shadow-sm">
                    <CardHeader className="pb-3 border-b bg-gradient-to-r from-blue-50/60 to-violet-50/40">
                      <CardTitle className="text-base font-semibold">
                        Tâches ({childTasks.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <StepTimeline tasks={childTasks} profiles={profiles} />
                    </CardContent>
                  </Card>
                ) : (
                  subProcessGroups.map((group) => (
                    <Card key={group.subProcessId} className="overflow-hidden shadow-sm">
                      <CardHeader className="pb-3 border-b bg-gradient-to-r from-blue-50/60 to-violet-50/40">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="min-w-0">
                            <CardTitle className="text-base font-semibold truncate capitalize">
                              {group.subProcessName}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {group.done} sur {group.total} étape{group.total > 1 ? 's' : ''} terminée{group.done > 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <Progress value={group.progressPercent} className="w-28 h-2" />
                            <span className="text-sm font-semibold tabular-nums w-11 text-right">{group.progressPercent}%</span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <StepTimeline tasks={group.tasks} profiles={profiles} />
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              {/* ═════ SYNTHÈSE ═════ */}
              <TabsContent value="synthesis" className="mt-5 space-y-5">
                <Card className="overflow-hidden shadow-sm">
                  <CardHeader className="pb-3 border-b bg-gradient-to-r from-blue-50/60 to-violet-50/40">
                    <CardTitle className="text-base font-semibold">Récapitulatif</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-5">
                    {task.description && (
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                          Description
                        </p>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {task.description}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                      <InfoBlock label="Demandeur" icon={User}>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs bg-violet-100 text-violet-700">
                              {initials(profiles.get((task as any).requester_id ?? '') ?? '?')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {profiles.get((task as any).requester_id ?? '') ?? '—'}
                            </p>
                            {requesterDetails && (
                              <p className="text-xs text-muted-foreground truncate">
                                {[requesterDetails.job_title, requesterDetails.department, requesterDetails.company]
                                  .filter(Boolean).join(' · ')}
                              </p>
                            )}
                          </div>
                        </div>
                      </InfoBlock>

                      <InfoBlock label="Échéance" icon={Calendar}>
                        {dueDate ? (
                          <div className="text-sm">
                            <span className={cn('font-medium', dueOverdue && 'text-red-600')}>
                              {format(parseISO(dueDate), 'EEEE d MMMM yyyy', { locale: fr })}
                            </span>
                            {dueOverdue && (
                              <div className="mt-1 text-xs text-red-600 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                En retard de {Math.abs(dueIn ?? 0)} j
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Pas d'échéance définie</span>
                        )}
                      </InfoBlock>

                      <InfoBlock label="Avancement" icon={CheckCircle2}>
                        <div className="flex items-center gap-3">
                          <Progress value={globalProgress} className="flex-1 h-2" />
                          <span className="text-sm font-semibold tabular-nums">{globalProgress}%</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {totalDone} sur {childTasks.length} étape{childTasks.length > 1 ? 's' : ''} terminée{totalDone > 1 ? 's' : ''}
                        </p>
                      </InfoBlock>

                      <InfoBlock label="Structure" icon={ListChecks}>
                        <div className="text-sm">
                          <span className="font-semibold">{childTasks.length}</span> étape{childTasks.length > 1 ? 's' : ''}
                          {' réparties sur '}
                          <span className="font-semibold">{subProcessGroups.length || 1}</span> sous-processus
                        </div>
                      </InfoBlock>
                    </div>
                  </CardContent>
                </Card>

              </TabsContent>
            </Tabs>

            {/* ── Actions ─────────────────────────────────────── */}
            {canCancel && (
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isCancelling}
                  className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                >
                  {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                  Annuler la demande
                </Button>
              </div>
            )}
          </div>
        </main>

        {/* ─────────────────────────────────────────────────── */}
        {/* PANNEAU CONVERSATION (DROITE) — toujours visible    */}
        {/* ─────────────────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-[380px] xl:w-[420px] border-l border-violet-200/60 bg-violet-50/30 shrink-0">
          <div className="px-4 h-12 flex items-center gap-2 border-b border-violet-200/60 shrink-0 bg-gradient-to-r from-violet-100/80 to-blue-100/60">
            <MessageSquare className="h-4 w-4 text-violet-600" />
            <h2 className="text-sm font-semibold text-violet-900">Conversation de la demande</h2>
          </div>
          <div className="flex-1 overflow-hidden p-3 min-h-0">
            <TaskCommentsSection taskId={task.id} className="h-full" />
          </div>
        </aside>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Timeline verticale des étapes — style portail de suivi
// ════════════════════════════════════════════════════════════════════════
function StepTimeline({ tasks, profiles }: { tasks: Task[]; profiles: Map<string, string> }) {
  const navigate = useNavigate();
  if (tasks.length === 0) {
    return <p className="text-xs text-muted-foreground italic p-6">Aucune étape.</p>;
  }

  return (
    <ol className="divide-y">
      {tasks.map((t, idx) => {
        const beStatus = (t as any).be_status as string | null | undefined;
        const stat = STATUS_META[t.status as string] ?? STATUS_META.todo;
        const beMeta = beStatus ? getBEStatusMeta(beStatus) : null;
        const isDone = ['done', 'validated'].includes(t.status as string) || beStatus === 'cloturee';
        const isActive = (t.status as string) === 'in-progress'
          || ['en_cours', 'a_relire', 'a_valider', 'a_deposer'].includes(beStatus ?? '');
        const validatedAt = (t as any).validated_at as string | null | undefined;
        const completedAt = (t as any).completed_at as string | null | undefined;
        const finishedAt = validatedAt || completedAt;
        const assigneeName = (t as any).assignee_id ? profiles.get((t as any).assignee_id) : null;
        const validatorName = (t as any).validator_level_1_id ? profiles.get((t as any).validator_level_1_id) : null;

        return (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => navigate(`/demande/${t.id}`)}
              className="group w-full flex items-start gap-4 p-4 sm:p-5 hover:bg-muted/30 transition-colors text-left"
            >
              {/* Cercle numéro/statut + ligne verticale */}
              <div className="relative flex flex-col items-center shrink-0 pt-0.5">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ring-4 ring-background z-10 transition-colors',
                  isDone     && 'bg-emerald-500 text-white',
                  !isDone && isActive && 'bg-amber-500 text-white',
                  !isDone && !isActive && 'bg-slate-200 text-slate-600',
                )}>
                  {isDone
                    ? <CheckCircle2 className="h-4 w-4" />
                    : isActive
                      ? <Clock className="h-4 w-4" />
                      : (idx + 1)}
                </div>
              </div>

              {/* Contenu */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className={cn(
                        'text-sm font-medium leading-snug',
                        isDone && 'line-through text-muted-foreground'
                      )}>
                        {stripPrefix(t.title)}
                      </h4>
                      {beMeta ? (
                        <Badge className={cn('text-[10px] px-1.5 py-0 border-0 shrink-0', beMeta.bgClass, beMeta.textClass)}>
                          {beMeta.icon} {beMeta.label}
                        </Badge>
                      ) : (
                        <Badge className={cn('text-[10px] px-1.5 py-0 border-0 shrink-0', stat.chip)}>
                          {stat.label}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 mt-0.5" />
                </div>

                {/* Méta : assigné / validateur / dates */}
                <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap text-xs">
                  {assigneeName ? (
                    <span className="flex items-center gap-1.5">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[9px] bg-blue-100 text-blue-700">{initials(assigneeName)}</AvatarFallback>
                      </Avatar>
                      <span className="text-muted-foreground">{assigneeName}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-700 font-medium">
                      <UserPlus className="h-3 w-3" />
                      À affecter
                    </span>
                  )}
                  {validatorName && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <ShieldCheck className="h-3 w-3" />
                      Valid. : {validatorName}
                    </span>
                  )}
                  {finishedAt ? (
                    <span className="flex items-center gap-1 text-emerald-700 font-medium">
                      <CheckCircle2 className="h-3 w-3" />
                      Validée le {format(parseISO(finishedAt), 'd MMM yyyy', { locale: fr })}
                    </span>
                  ) : (t as any).due_date && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Échéance {format(parseISO((t as any).due_date), 'd MMM', { locale: fr })}
                    </span>
                  )}
                  {(t as any).is_milestone && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-violet-200 bg-violet-50 text-violet-700">
                      <Flag className="h-2.5 w-2.5 mr-0.5" />
                      Jalon
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// ════════════════════════════════════════════════════════════════════════
function InfoBlock({ label, icon: Icon, children }: { label: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <div>{children}</div>
    </div>
  );
}

// Strip prefix « D-XXX-0001 — » ou « T-XXX-0001 — » + nom prestation pour
// afficher juste l'étape dans la timeline (déjà groupée par sous-processus)
function stripPrefix(title: string | null | undefined): string {
  if (!title) return '';
  return title.replace(/^([TD]-[A-Z][A-Z0-9-]*\d+\s*—\s*)+/, '')
              .replace(/^[^—]+—[^—]+—\s*/, ''); // retire « demande — presta — » s'il y a 3 niveaux
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase() ?? '')
    .join('') || '?';
}
