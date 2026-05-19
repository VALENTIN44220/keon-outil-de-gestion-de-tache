/**
 * RequestDetail — Page plein écran du détail d'une demande.
 *
 * Remplace le dialog modal pour les vues riches.
 *
 * Structure :
 *  Header : breadcrumb + numéro + titre + badges + actions
 *  Onglet 1 « Étapes »          : liste des tâches enfant avec statut,
 *                                 assigné, dates de validation, progress global
 *  Onglet 2 « Synthèse & Discussion » : récap demande + chat
 *
 * Conventions typographiques (uniformes) :
 *   - Titre h1     : text-2xl font-bold tracking-tight
 *   - Section h2   : text-base font-semibold
 *   - Labels       : text-xs font-medium uppercase tracking-wide text-muted-foreground
 *   - Body         : text-sm
 *   - Meta inline  : text-xs text-muted-foreground
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatchedRouteParam } from '@/hooks/useMatchedRouteParam';
import { Sidebar } from '@/components/layout/Sidebar';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Building2, Calendar, CheckCircle2, ChevronRight, Clock,
  Flag, ListChecks, MessageSquare, User, Workflow, AlertTriangle,
  ShieldCheck, FileText, Loader2, Ban, UserPlus,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Task } from '@/types/task';
import { cn } from '@/lib/utils';
import { TaskCommentsSection } from '@/components/tasks/TaskCommentsSection';
import { getBEStatusMeta } from '@/hooks/useBETaskStatus';
import { toast } from 'sonner';

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  to_assign:            { label: 'À affecter',        color: 'text-slate-700',   bg: 'bg-slate-100' },
  todo:                 { label: 'À faire',           color: 'text-blue-700',    bg: 'bg-blue-100' },
  'in-progress':        { label: 'En cours',          color: 'text-amber-700',   bg: 'bg-amber-100' },
  pending_validation_1: { label: 'En validation N1',  color: 'text-violet-700',  bg: 'bg-violet-100' },
  pending_validation_2: { label: 'En validation N2',  color: 'text-violet-700',  bg: 'bg-violet-100' },
  done:                 { label: 'Terminé',           color: 'text-emerald-700', bg: 'bg-emerald-100' },
  validated:            { label: 'Validé',            color: 'text-emerald-700', bg: 'bg-emerald-100' },
  cancelled:            { label: 'Annulé',            color: 'text-red-700',     bg: 'bg-red-100' },
  refused:              { label: 'Refusé',            color: 'text-red-700',     bg: 'bg-red-100' },
};

const PRIORITY_LABEL: Record<string, { label: string; color: string }> = {
  low:    { label: 'Faible',    color: 'bg-slate-100 text-slate-700' },
  medium: { label: 'Moyenne',   color: 'bg-blue-100 text-blue-700' },
  high:   { label: 'Élevée',    color: 'bg-amber-100 text-amber-700' },
  urgent: { label: 'Urgente',   color: 'bg-red-100 text-red-700' },
};

interface SubProcessGroup {
  subProcessId: string;
  subProcessName: string;
  tasks: Task[];
  progressPercent: number;
  done: number;
  total: number;
}

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

  // ─── Fetch ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!taskId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const load = async () => {
    if (!taskId) return;
    setIsLoading(true);
    try {
      const { data: t, error } = await supabase
        .from('tasks').select('*').eq('id', taskId).single();
      if (error) throw error;
      if (!t) { navigate(-1); return; }
      setTask(t as Task);

      // Children
      const { data: kids } = await supabase
        .from('tasks').select('*').eq('parent_request_id', taskId).order('created_at');
      setChildTasks((kids || []) as Task[]);

      // Process name
      if ((t as any).source_process_template_id) {
        const { data: pData } = await supabase
          .from('process_templates').select('name')
          .eq('id', (t as any).source_process_template_id).maybeSingle();
        if (pData) setProcessName(pData.name);
      }

      // Sub-process names (unique ids)
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

      // Profiles (requester + assignees + validators)
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
        for (const p of (profs || []) as any[]) {
          map.set(p.id, p.display_name || 'Sans nom');
        }
        setProfiles(map);
        // Détails du demandeur
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
      toast.error('Erreur de chargement de la demande');
      navigate(-1);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Groupes par sous-processus ────────────────────────────────
  const subProcessGroups = useMemo<SubProcessGroup[]>(() => {
    const groups = new Map<string, Task[]>();
    for (const c of childTasks) {
      const id =
        (c as any).sub_process_template_id ||
        (c as any).source_sub_process_template_id ||
        '__direct__';
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id)!.push(c);
    }
    return Array.from(groups.entries())
      .filter(([id]) => id !== '__direct__')
      .map(([id, tasks]) => {
        const done = tasks.filter(t => ['done', 'validated', 'cloturee'].includes(t.status as string) || ['cloturee'].includes((t as any).be_status)).length;
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

  // ─── Actions ───────────────────────────────────────────────────
  const isBERequest = (task as any)?.source_process_template_id === 'bd75a3b0-c918-4b43-befe-739b83f7461a';

  const handleCancel = async () => {
    if (!task) return;
    if (!window.confirm('Annuler définitivement cette demande ?')) return;
    setIsCancelling(true);
    const { error } = await supabase.from('tasks').update({ status: 'cancelled' }).eq('id', task.id);
    setIsCancelling(false);
    if (error) { toast.error(`Erreur : ${error.message}`); return; }
    toast.success('Demande annulée');
    navigate(-1);
  };

  // ─── Render ────────────────────────────────────────────────────
  if (isLoading || !task) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar activeView={activeView} onViewChange={setActiveView} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <PageHeader title="Chargement…" />
          <main className="flex-1 overflow-y-auto p-6 space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </main>
        </div>
      </div>
    );
  }

  const statusMeta = STATUS_META[task.status as string] ?? STATUS_META.todo;
  const prioMeta = PRIORITY_LABEL[task.priority as string] ?? PRIORITY_LABEL.medium;
  const dueDate = (task as any).due_date as string | null | undefined;
  const dueDateOverdue = dueDate ? new Date(dueDate) < new Date() && !['done', 'validated', 'cancelled'].includes(task.status as string) : false;

  const canCancel = !['done', 'validated', 'cancelled'].includes(task.status as string)
    && (isAdmin || task.requester_id === profile?.id);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader
          title={
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Building2 className="h-5 w-5 text-primary" />
              <span className="text-base font-semibold">Demande</span>
            </div>
          }
        />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto p-6 space-y-6">

            {/* ── Bandeau identité ───────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {task.request_number && (
                  <Badge variant="outline" className="font-mono text-[11px] px-2 py-0.5">
                    {task.request_number}
                  </Badge>
                )}
                <Badge className={cn('text-[10px] px-2 py-0.5 border-0', prioMeta.color)}>
                  <Flag className="h-2.5 w-2.5 mr-1" />
                  {prioMeta.label}
                </Badge>
                <Badge className={cn('text-[10px] px-2 py-0.5 border-0', statusMeta.bg, statusMeta.color)}>
                  {statusMeta.label}
                </Badge>
                {processName && (
                  <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground border-dashed">
                    <Workflow className="h-2.5 w-2.5" />
                    {processName}
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold tracking-tight">
                {(task.title ?? '').replace(/^([TD]-[A-Z][A-Z0-9-]*\d+\s*—\s*)+/, '')}
              </h1>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Créée le {format(parseISO((task as any).created_at), 'dd MMM yyyy', { locale: fr })}
                </span>
                {dueDate && (
                  <span className={cn('flex items-center gap-1.5', dueDateOverdue && 'text-red-600 font-medium')}>
                    <Clock className="h-3.5 w-3.5" />
                    Échéance {format(parseISO(dueDate), 'dd MMM yyyy', { locale: fr })}
                    {dueDateOverdue && ' · en retard'}
                  </span>
                )}
              </div>
            </div>

            {/* ── Onglets ────────────────────────────────────── */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'steps' | 'synthesis')}>
              <TabsList className="bg-muted/40">
                <TabsTrigger value="steps" className="gap-2 text-sm">
                  <ListChecks className="h-4 w-4" />
                  Étapes
                  {childTasks.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {globalProgress}%
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="synthesis" className="gap-2 text-sm">
                  <MessageSquare className="h-4 w-4" />
                  Synthèse & Discussion
                </TabsTrigger>
              </TabsList>

              {/* ════ Onglet Étapes ════ */}
              <TabsContent value="steps" className="mt-4 space-y-4">
                {/* Avancement global */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold">Avancement global</CardTitle>
                      <span className="text-lg font-bold text-violet-600 tabular-nums">{globalProgress}%</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Progress value={globalProgress} className="h-3" />
                    <p className="text-xs text-muted-foreground mt-2">
                      {childTasks.filter(t => ['done', 'validated'].includes(t.status as string) || (t as any).be_status === 'cloturee').length} étape{childTasks.length > 1 ? 's' : ''} terminée{childTasks.length > 1 ? 's' : ''} sur {childTasks.length}
                    </p>
                  </CardContent>
                </Card>

                {/* Étapes groupées par sous-processus (ou liste plate si une seule presta) */}
                {childTasks.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center text-sm text-muted-foreground">
                      <FileText className="h-10 w-10 mx-auto opacity-30 mb-3" />
                      Aucune étape pour cette demande.
                    </CardContent>
                  </Card>
                ) : subProcessGroups.length === 0 ? (
                  // Pas de groupement par sous-processus → liste plate
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold">Tâches ({childTasks.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <StepList tasks={childTasks} profiles={profiles} />
                    </CardContent>
                  </Card>
                ) : (
                  subProcessGroups.map((group) => (
                    <Card key={group.subProcessId}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <CardTitle className="text-base font-semibold">{group.subProcessName}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {group.done}/{group.total} étape{group.total > 1 ? 's' : ''} terminée{group.done > 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Progress value={group.progressPercent} className="w-24 h-2" />
                            <span className="text-sm font-semibold tabular-nums w-10 text-right">{group.progressPercent}%</span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <StepList tasks={group.tasks} profiles={profiles} />
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              {/* ════ Onglet Synthèse + Discussion ════ */}
              <TabsContent value="synthesis" className="mt-4 space-y-4">
                {/* Récap */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold">Synthèse</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    {task.description && (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">Description</p>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{task.description}</p>
                      </div>
                    )}

                    <Separator />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <InfoBlock label="Demandeur" icon={User}>
                        <div className="text-sm font-medium">{profiles.get((task as any).requester_id ?? '') ?? '—'}</div>
                        {requesterDetails && (
                          <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                            {requesterDetails.company && <div>{requesterDetails.company}</div>}
                            {requesterDetails.department && <div>{requesterDetails.department}</div>}
                            {requesterDetails.job_title && <div className="italic">{requesterDetails.job_title}</div>}
                          </div>
                        )}
                      </InfoBlock>

                      <InfoBlock label="Échéance" icon={Calendar}>
                        {dueDate ? (
                          <div className={cn('text-sm font-medium', dueDateOverdue && 'text-red-600')}>
                            {format(parseISO(dueDate), 'EEEE dd MMMM yyyy', { locale: fr })}
                            {dueDateOverdue && (
                              <span className="ml-2 text-xs font-normal">
                                <AlertTriangle className="h-3 w-3 inline mr-0.5" /> en retard
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Pas d'échéance</span>
                        )}
                      </InfoBlock>

                      <InfoBlock label="Avancement" icon={CheckCircle2}>
                        <div className="flex items-center gap-2">
                          <Progress value={globalProgress} className="flex-1 h-2" />
                          <span className="text-sm font-semibold tabular-nums">{globalProgress}%</span>
                        </div>
                      </InfoBlock>

                      <InfoBlock label="Étapes" icon={ListChecks}>
                        <div className="text-sm">
                          <span className="font-semibold">{childTasks.length}</span> étape{childTasks.length > 1 ? 's' : ''}
                          <span className="text-muted-foreground">
                            {' '}— {subProcessGroups.length || 1} sous-processus
                          </span>
                        </div>
                      </InfoBlock>
                    </div>
                  </CardContent>
                </Card>

                {/* Discussion */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      Discussion
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TaskCommentsSection taskId={task.id} className="min-h-[280px] max-h-[60vh]" />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* ── Actions globales ──────────────────────────── */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              {canCancel && (
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isCancelling}
                  className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
                >
                  {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                  Annuler la demande
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Retour
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Liste compacte d'étapes
// ════════════════════════════════════════════════════════════════════════
function StepList({ tasks, profiles }: { tasks: Task[]; profiles: Map<string, string> }) {
  const navigate = useNavigate();

  if (tasks.length === 0) {
    return <p className="text-xs text-muted-foreground italic">Aucune étape.</p>;
  }

  return (
    <ul className="divide-y -mx-3">
      {tasks.map((t) => {
        const beStatus = (t as any).be_status as string | null | undefined;
        const stat = STATUS_META[t.status as string] ?? STATUS_META.todo;
        const beMeta = beStatus ? getBEStatusMeta(beStatus) : null;
        const isDone = ['done', 'validated'].includes(t.status as string) || beStatus === 'cloturee';
        const validatedAt = (t as any).validated_at as string | null | undefined;
        const completedAt = (t as any).completed_at as string | null | undefined;
        const finishedAt = validatedAt || completedAt;

        return (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => navigate(`/demande/${t.id}`)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors text-left"
            >
              {/* Icône statut */}
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                isDone ? 'bg-emerald-100 text-emerald-700' :
                (t.status === 'in-progress' || beStatus === 'en_cours') ? 'bg-amber-100 text-amber-700' :
                'bg-slate-100 text-slate-500',
              )}>
                {isDone ? <CheckCircle2 className="h-4 w-4" /> :
                 beStatus === 'a_relire' || beStatus === 'a_valider' ? <ShieldCheck className="h-4 w-4" /> :
                 (t.status === 'in-progress' || beStatus === 'en_cours') ? <Clock className="h-4 w-4" /> :
                 <Flag className="h-4 w-4" />}
              </div>

              {/* Titre + meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={cn('text-sm font-medium truncate', isDone && 'line-through text-muted-foreground')}>
                    {t.title}
                  </p>
                  {beMeta ? (
                    <Badge className={cn('text-[10px] px-1.5 py-0 border-0', beMeta.bgClass, beMeta.textClass)}>
                      {beMeta.icon} {beMeta.label}
                    </Badge>
                  ) : (
                    <Badge className={cn('text-[10px] px-1.5 py-0 border-0', stat.bg, stat.color)}>
                      {stat.label}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {(t as any).assignee_id ? (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {profiles.get((t as any).assignee_id) ?? 'Inconnu'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600">
                      <UserPlus className="h-3 w-3" />
                      À affecter
                    </span>
                  )}
                  {(t as any).validator_level_1_id && (
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      Valideur : {profiles.get((t as any).validator_level_1_id)}
                    </span>
                  )}
                  {finishedAt && (
                    <span className="flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      Validée le {format(parseISO(finishedAt), 'dd MMM yyyy', { locale: fr })}
                    </span>
                  )}
                  {!finishedAt && (t as any).due_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Échéance {format(parseISO((t as any).due_date), 'dd MMM', { locale: fr })}
                    </span>
                  )}
                </div>
              </div>

              <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function InfoBlock({ label, icon: Icon, children }: { label: string; icon: any; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1.5">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      {children}
    </div>
  );
}
