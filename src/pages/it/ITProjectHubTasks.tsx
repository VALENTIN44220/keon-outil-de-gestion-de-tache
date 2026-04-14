import { useState, useMemo, useEffect, useCallback } from 'react';
import { useITProjectHubCode } from '@/hooks/useITProjectHubCode';
import { Layout } from '@/components/layout/Layout';
import { ITProjectHubHeader } from '@/components/it/ITProjectHubHeader';
import { useITProject, useITProjectStats } from '@/hooks/useITProjectHub';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Search, ListTodo, Link2, ExternalLink, Inbox, CheckSquare,
  AlertTriangle, ChevronDown, ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Task, TaskStatus } from '@/types/task';
import { IT_PROJECT_PHASES, IT_PHASE_BADGE_CONFIG, ITProjectPhase } from '@/types/itProject';
import { ITLinkExistingTasksDialog } from '@/components/it/ITLinkExistingTasksDialog';
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  'to_assign': { label: 'À assigner', className: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
  'todo': { label: 'À faire', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  'in-progress': { label: 'En cours', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  'done': { label: 'Terminé', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  'validated': { label: 'Validé', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  'cancelled': { label: 'Annulé', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
  'review': { label: 'Revue', className: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  'pending_validation_1': { label: 'Validation N1', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  'pending_validation_2': { label: 'Validation N2', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  'refused': { label: 'Refusé', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
};

const NONE_PHASE = '__none__';
type StatusFilter = 'all' | 'open' | 'done' | 'cancelled';

function getItemKind(task: Task): 'request' | 'task' {
  if (task.type === 'request') return 'request';
  if (!task.parent_request_id && (task as any).source_process_template_id) return 'request';
  return 'task';
}

function isOverdue(task: Task): boolean {
  if (!task.due_date) return false;
  if (['done', 'validated', 'cancelled'].includes(task.status)) return false;
  return new Date(task.due_date) < new Date();
}

export default function ITProjectHubTasks() {
  const code = useITProjectHubCode();
  const { data: project, isLoading } = useITProject(code);
  const queryClient = useQueryClient();

  const [allItems, setAllItems] = useState<Task[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [collapsedRequests, setCollapsedRequests] = useState<Set<string>>(new Set());

  const loadTasks = useCallback(async () => {
    if (!project?.id) return;
    setItemsLoading(true);
    try {
      const { data: projectTasks, error: e1 } = await supabase
        .from('tasks')
        .select(`*, assignee:profiles!tasks_assignee_id_fkey(id,display_name,avatar_url), requester:profiles!tasks_requester_id_fkey(id,display_name,avatar_url)`)
        .eq('it_project_id', project.id)
        .order('created_at', { ascending: false });
      if (e1) throw e1;

      const tasks = (projectTasks || []) as Task[];

      const requestIds = tasks
        .filter(t => !t.parent_request_id && (t.type === 'request' || (t as any).source_process_template_id))
        .map(t => t.id);

      let childTasks: Task[] = [];
      if (requestIds.length > 0) {
        const { data: children, error: e2 } = await supabase
          .from('tasks')
          .select(`*, assignee:profiles!tasks_assignee_id_fkey(id,display_name,avatar_url), requester:profiles!tasks_requester_id_fkey(id,display_name,avatar_url)`)
          .in('parent_request_id', requestIds)
          .order('created_at', { ascending: true });
        if (e2) throw e2;
        childTasks = (children || []) as Task[];
      }

      const allMap = new Map<string, Task>();
      tasks.forEach(t => allMap.set(t.id, t));
      childTasks.forEach(t => { if (!allMap.has(t.id)) allMap.set(t.id, t); });

      setAllItems(Array.from(allMap.values()));
    } catch (err) {
      console.error('Error loading IT project tasks:', err);
    } finally {
      setItemsLoading(false);
    }
  }, [project?.id]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const { topLevel, childrenMap, counters } = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = (t: Task) => {
      if (!q) return true;
      const haystack = [t.title, t.task_number, t.request_number].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    };
    const matchesStatus = (t: Task) => {
      if (statusFilter === 'open') return !['done', 'validated', 'cancelled'].includes(t.status);
      if (statusFilter === 'done') return ['done', 'validated'].includes(t.status);
      if (statusFilter === 'cancelled') return t.status === 'cancelled';
      return true;
    };

    const childrenMap = new Map<string, Task[]>();
    const topLevel: Task[] = [];
    const withParent: Task[] = [];
    const withoutParent: Task[] = [];
    allItems.forEach(t => {
      if (t.parent_request_id) withParent.push(t);
      else withoutParent.push(t);
    });

    withParent.forEach(t => {
      const pid = t.parent_request_id!;
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid)!.push(t);
    });

    withoutParent.forEach(t => {
      const children = childrenMap.get(t.id) || [];
      const parentMatches = matchesSearch(t) && matchesStatus(t);
      const anyChildMatches = children.some(c => matchesSearch(c) && matchesStatus(c));
      if (parentMatches || anyChildMatches) topLevel.push(t);
    });

    for (const [pid, children] of childrenMap.entries()) {
      const filtered = children.filter(c => matchesSearch(c) && matchesStatus(c));
      childrenMap.set(pid, filtered);
    }

    let requestCount = 0, taskCount = 0, overdueCount = 0;
    allItems.forEach(t => {
      if (getItemKind(t) === 'request') requestCount++;
      else taskCount++;
      if (isOverdue(t)) overdueCount++;
    });

    return { topLevel, childrenMap, counters: { requests: requestCount, tasks: taskCount, overdue: overdueCount } };
  }, [allItems, searchQuery, statusFilter]);

  const stats = useITProjectStats(allItems, project);

  const toggleCollapse = (id: string) => {
    setCollapsedRequests(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    loadTasks();
    queryClient.invalidateQueries({ queryKey: ['it-project-tasks'] });
  };

  const handlePhaseChange = async (taskId: string, phase: string | null) => {
    const { error } = await supabase.from('tasks').update({ it_project_phase: phase }).eq('id', taskId);
    if (error) { toast.error('Erreur: ' + error.message); return; }
    setAllItems(prev => prev.map(t => t.id === taskId ? { ...t, it_project_phase: phase } : t));
    queryClient.invalidateQueries({ queryKey: ['it-project-tasks'] });
  };

  if (isLoading || !project) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col h-full">
        <ITProjectHubHeader project={project} stats={stats} />
        <div className="flex-1 overflow-auto p-6 space-y-4">

          {/* Counters */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Inbox className="h-4 w-4 text-blue-500" />
              <span className="font-semibold">{counters.requests}</span>
              <span className="text-muted-foreground">Demandes</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckSquare className="h-4 w-4 text-emerald-500" />
              <span className="font-semibold">{counters.tasks}</span>
              <span className="text-muted-foreground">Tâches</span>
            </div>
            {counters.overdue > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="font-semibold text-destructive">{counters.overdue}</span>
                <span className="text-muted-foreground">En retard</span>
              </div>
            )}
          </div>

          {/* Filters */}
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par titre ou numéro..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
                  {([
                    { value: 'all', label: 'Toutes' },
                    { value: 'open', label: 'Ouvertes' },
                    { value: 'done', label: 'Terminées' },
                    { value: 'cancelled', label: 'Annulées' },
                  ] as { value: StatusFilter; label: string }[]).map(opt => (
                    <Button
                      key={opt.value}
                      variant={statusFilter === opt.value ? 'default' : 'ghost'}
                      size="sm"
                      className={cn('h-7 px-3 text-xs', statusFilter === opt.value && 'shadow-sm')}
                      onClick={() => setStatusFilter(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hierarchical list */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ListTodo className="h-5 w-5 text-muted-foreground" />
                  Tâches & Demandes
                  <Badge variant="secondary" className="ml-2">{topLevel.length}</Badge>
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setLinkDialogOpen(true)}>
                  <Link2 className="h-4 w-4 mr-1.5" />
                  Associer des tâches existantes
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {itemsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-600" />
                </div>
              ) : topLevel.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <div className="p-4 rounded-full bg-muted inline-block mb-4">
                    <ListTodo className="h-8 w-8 opacity-50" />
                  </div>
                  <p className="font-medium">Aucune tâche trouvée</p>
                  <p className="text-sm mt-1">
                    {allItems.length === 0
                      ? `Aucune tâche associée au projet ${project.code_projet_digital}`
                      : 'Modifiez vos filtres pour voir plus de résultats'
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {topLevel.map(item => {
                    const kind = getItemKind(item);
                    const children = childrenMap.get(item.id) || [];
                    const hasChildren = children.length > 0;
                    const isCollapsed = collapsedRequests.has(item.id);

                    return (
                      <div key={item.id}>
                        <TaskRow
                          task={item}
                          kind={kind}
                          hasChildren={hasChildren}
                          isCollapsed={isCollapsed}
                          onToggleCollapse={() => toggleCollapse(item.id)}
                          onSelect={() => setSelectedTask(item)}
                          onPhaseChange={handlePhaseChange}
                        />
                        {hasChildren && !isCollapsed && (
                          <div className="relative ml-4">
                            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-violet-300/50 dark:bg-violet-700/40" />
                            {children.map((child) => (
                              <div key={child.id} className="relative">
                                <div className="absolute left-3 top-4 w-3 h-0.5 bg-violet-300/50 dark:bg-violet-700/40" />
                                <div className="ml-6">
                                  <TaskRow
                                    task={child}
                                    kind="task"
                                    hasChildren={false}
                                    isCollapsed={false}
                                    onToggleCollapse={() => {}}
                                    onSelect={() => setSelectedTask(child)}
                                    onPhaseChange={handlePhaseChange}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <ITLinkExistingTasksDialog
          open={linkDialogOpen}
          onOpenChange={(open) => { setLinkDialogOpen(open); if (!open) loadTasks(); }}
          projectId={project.id}
        />

        <TaskDetailDialog
          task={selectedTask}
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onStatusChange={handleStatusChange}
          onTaskMutated={loadTasks}
        />
      </div>
    </Layout>
  );
}

// ─── Task Row Component ──────────────────────────────
interface TaskRowProps {
  task: Task;
  kind: 'request' | 'task';
  hasChildren: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSelect: () => void;
  onPhaseChange: (taskId: string, phase: string | null) => void;
}

function TaskRow({ task, kind, hasChildren, isCollapsed, onToggleCollapse, onSelect, onPhaseChange }: TaskRowProps) {
  const number = kind === 'request' ? task.request_number : task.task_number;
  const statusConf = STATUS_LABELS[task.status] || { label: task.status, className: 'bg-muted text-muted-foreground' };
  const assignee = (task as any).assignee;
  const overdue = isOverdue(task);
  const phaseConf = task.it_project_phase ? IT_PHASE_BADGE_CONFIG[task.it_project_phase as ITProjectPhase] : null;

  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors hover:bg-muted/40 cursor-pointer',
        overdue && 'bg-destructive/5',
      )}
      onClick={onSelect}
    >
      {/* Collapse toggle */}
      <div className="w-5 flex-shrink-0">
        {hasChildren && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
            className="p-0.5 rounded hover:bg-muted transition-colors"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
        )}
      </div>

      {/* Type badge */}
      {kind === 'request' ? (
        <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 border text-[10px] gap-1 flex-shrink-0">
          <Inbox className="h-3 w-3" /> Demande
        </Badge>
      ) : (
        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 border text-[10px] gap-1 flex-shrink-0">
          <CheckSquare className="h-3 w-3" /> Tâche
        </Badge>
      )}

      {/* Number */}
      <span className="font-mono text-xs text-muted-foreground flex-shrink-0 w-[100px] truncate">
        {number || '—'}
      </span>

      {/* Title */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm font-medium truncate">{task.title}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {kind === 'request' ? 'Ouvrir la demande' : 'Ouvrir la tâche'}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Phase select */}
      <div className="flex-shrink-0 w-[130px]" onClick={e => e.stopPropagation()}>
        <Select
          value={task.it_project_phase || NONE_PHASE}
          onValueChange={v => onPhaseChange(task.id, v === NONE_PHASE ? null : v)}
        >
          <SelectTrigger className={cn(
            'h-6 text-[10px] px-2 border',
            phaseConf ? phaseConf.className : 'text-muted-foreground'
          )}>
            <SelectValue placeholder="Phase..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_PHASE}>— Aucune —</SelectItem>
            {IT_PROJECT_PHASES.map(p => (
              <SelectItem key={p.value} value={p.value}>
                {IT_PHASE_BADGE_CONFIG[p.value]?.label || p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status badge */}
      <Badge className={cn(statusConf.className, 'border text-[10px] flex-shrink-0')}>
        {statusConf.label}
      </Badge>

      {/* Overdue */}
      {overdue && (
        <Tooltip>
          <TooltipTrigger>
            <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
          </TooltipTrigger>
          <TooltipContent className="text-xs">En retard</TooltipContent>
        </Tooltip>
      )}

      {/* Assignee */}
      <div className="w-[120px] flex-shrink-0">
        {assignee ? (
          <div className="flex items-center gap-1.5">
            <Avatar className="h-5 w-5">
              <AvatarImage src={assignee.avatar_url} />
              <AvatarFallback className="text-[9px]">{assignee.display_name?.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="text-xs truncate">{assignee.display_name}</span>
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground">Non assigné</span>
        )}
      </div>

      {/* Due date */}
      <div className="w-[70px] flex-shrink-0 text-right">
        {task.due_date ? (
          <span className={cn('text-xs', overdue && 'text-destructive font-medium')}>
            {format(new Date(task.due_date), 'dd/MM/yy', { locale: fr })}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}
