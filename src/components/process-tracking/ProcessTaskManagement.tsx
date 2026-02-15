import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Task, TaskStats, TaskStatus } from '@/types/task';
import { DashboardToolbar, KanbanGroupMode } from '@/components/dashboard/DashboardToolbar';
import { CrossFiltersPanel } from '@/components/dashboard/CrossFiltersPanel';
import { CrossFilters, DEFAULT_CROSS_FILTERS } from '@/components/dashboard/types';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { TaskList } from '@/components/tasks/TaskList';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { CalendarView } from '@/components/tasks/CalendarView';
import { DenseTableView } from '@/components/tasks/DenseTableView';
import { TaskView } from '@/components/tasks/TaskViewSelector';
import { useCategories } from '@/hooks/useCategories';
import { useTasksProgress } from '@/hooks/useChecklists';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

interface ProcessTaskManagementProps {
  processId?: string;
  departmentId?: string;
  processIds?: string[];
  canWrite?: boolean;
}

export function ProcessTaskManagement({ processId, departmentId, processIds, canWrite = false }: ProcessTaskManagementProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [taskView, setTaskView] = useState<TaskView>('grid');
  const [kanbanGroupMode, setKanbanGroupMode] = useState<KanbanGroupMode>('status');
  const [crossFilters, setCrossFilters] = useState<CrossFilters>(DEFAULT_CROSS_FILTERS);
  const [showFullStats, setShowFullStats] = useState(false);
  const [profilesMap, setProfilesMap] = useState<Map<string, string>>(new Map());
  const { categories } = useCategories();

  const isDeptMode = !!departmentId && !processId;
  const effectiveId = processId || departmentId || '';

  const fetchTasks = useCallback(async () => {
    if (!user || !effectiveId) return;
    setIsLoading(true);

    let query = (supabase as any).from('tasks').select('*');

    if (isDeptMode && departmentId) {
      const conditions: string[] = [];
      conditions.push(`target_department_id.eq.${departmentId}`);
      if (processIds && processIds.length > 0) {
        processIds.forEach(pid => {
          conditions.push(`process_template_id.eq.${pid}`);
          conditions.push(`source_process_template_id.eq.${pid}`);
        });
      }
      query = query.or(conditions.join(','));
    } else if (processId) {
      query = query.or(`process_template_id.eq.${processId},source_process_template_id.eq.${processId}`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (!error && data) {
      if (isDeptMode && departmentId) {
        const { data: deptProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('department_id', departmentId);

        if (deptProfiles && deptProfiles.length > 0) {
          const existingIds = new Set((data as any[]).map(t => t.id));
          const { data: assigneeTasks } = await (supabase as any)
            .from('tasks')
            .select('*')
            .in('assignee_id', deptProfiles.map(p => p.id))
            .order('created_at', { ascending: false });

          if (assigneeTasks) {
            const extra = (assigneeTasks as any[]).filter(t => !existingIds.has(t.id));
            setTasks([...data, ...extra] as Task[]);
          } else {
            setTasks(data as Task[]);
          }
        } else {
          setTasks(data as Task[]);
        }
      } else {
        setTasks(data as Task[]);
      }
    }
    setIsLoading(false);
  }, [user, processId, departmentId, isDeptMode, processIds, effectiveId]);

  useEffect(() => {
    fetchTasks();

    const channel = supabase
      .channel(`process-task-mgmt-${effectiveId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
      }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTasks, effectiveId]);

  // Fetch profiles
  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase.from('profiles').select('id, display_name');
      if (data) {
        const map = new Map<string, string>();
        data.forEach(p => map.set(p.id, p.display_name || 'Sans nom'));
        setProfilesMap(map);
      }
    };
    fetchProfiles();
  }, []);

  const taskIds = useMemo(() => tasks.map(t => t.id), [tasks]);
  const { progressMap, globalProgress, globalStats } = useTasksProgress(taskIds);

  const stats: TaskStats = useMemo(() => {
    const total = tasks.length;
    const todo = tasks.filter(t => t.status === 'todo').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const done = tasks.filter(t => t.status === 'done').length;
    const pendingValidation = tasks.filter(t =>
      t.status === 'pending_validation_1' || t.status === 'pending_validation_2'
    ).length;
    const validated = tasks.filter(t => t.status === 'validated').length;
    const refused = tasks.filter(t => t.status === 'refused').length;
    const completionRate = total > 0 ? Math.round(((done + validated) / total) * 100) : 0;
    return { total, todo, inProgress, done, pendingValidation, validated, refused, completionRate };
  }, [tasks]);

  const updateTaskStatus = useCallback(async (taskId: string, status: TaskStatus) => {
    const { error } = await supabase
      .from('tasks')
      .update({ status })
      .eq('id', taskId);
    if (error) {
      toast.error('Erreur lors de la mise à jour du statut');
    } else {
      fetchTasks();
    }
  }, [fetchTasks]);

  const deleteTask = useCallback(async (taskId: string) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);
    if (error) {
      toast.error('Erreur lors de la suppression');
    } else {
      fetchTasks();
    }
  }, [fetchTasks]);

  // Apply cross filters
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (crossFilters.searchQuery && !task.title?.toLowerCase().includes(crossFilters.searchQuery.toLowerCase())) {
        return false;
      }
      if (crossFilters.statuses.length > 0 && !crossFilters.statuses.includes(task.status)) {
        return false;
      }
      if (crossFilters.priorities.length > 0 && task.priority && !crossFilters.priorities.includes(task.priority)) {
        return false;
      }
      if (crossFilters.assigneeIds.length > 0 && !crossFilters.assigneeIds.includes(task.assignee_id || '')) {
        return false;
      }
      if (crossFilters.categoryIds.length > 0 && !crossFilters.categoryIds.includes(task.category_id || '')) {
        return false;
      }
      return true;
    });
  }, [tasks, crossFilters]);

  const groupLabels = useMemo(() => {
    const labels = new Map<string, string>();
    profilesMap.forEach((name, id) => labels.set(id, name));
    categories.forEach(cat => {
      labels.set(cat.id, cat.name);
      cat.subcategories.forEach(sub => labels.set(sub.id, sub.name));
    });
    labels.set('Non assigné', 'Non assigné');
    labels.set('Non défini', 'Non défini');
    labels.set('Sans catégorie', 'Sans catégorie');
    return labels;
  }, [profilesMap, categories]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach(cat => map.set(cat.id, cat.name));
    return map;
  }, [categories]);

  const assigneeMap = useMemo(() => {
    const map = new Map<string, { display_name: string; avatar_url?: string }>();
    profilesMap.forEach((name, id) => map.set(id, { display_name: name }));
    return map;
  }, [profilesMap]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderTaskView = () => {
    switch (taskView) {
      case 'kanban':
        return (
          <KanbanBoard
            tasks={filteredTasks}
            onStatusChange={updateTaskStatus}
            onDelete={deleteTask}
            groupLabels={groupLabels}
            progressMap={progressMap}
            onTaskUpdated={fetchTasks}
            kanbanGroupMode={kanbanGroupMode}
            categoryMap={categoryMap}
            assigneeMap={assigneeMap}
          />
        );
      case 'calendar':
        return (
          <CalendarView
            tasks={filteredTasks}
            onStatusChange={updateTaskStatus}
            onDelete={deleteTask}
            groupLabels={groupLabels}
            progressMap={progressMap}
            onTaskUpdated={fetchTasks}
          />
        );
      case 'table':
        return (
          <DenseTableView
            tasks={filteredTasks}
            onStatusChange={updateTaskStatus}
            onDelete={deleteTask}
            progressMap={progressMap}
            onTaskUpdated={fetchTasks}
          />
        );
      default:
        return (
          <TaskList
            tasks={filteredTasks}
            onStatusChange={updateTaskStatus}
            onDelete={deleteTask}
            groupLabels={groupLabels}
            progressMap={progressMap}
            onTaskUpdated={fetchTasks}
          />
        );
    }
  };

  return (
    <div className="space-y-4">
      <DashboardToolbar
        currentView={taskView}
        onViewChange={setTaskView}
        kanbanGroupMode={kanbanGroupMode}
        onKanbanGroupModeChange={setKanbanGroupMode}
      />

      <CrossFiltersPanel
        filters={crossFilters}
        onFiltersChange={setCrossFilters}
        processId={effectiveId}
      />

      <div className="mb-4">
        <button
          onClick={() => setShowFullStats(!showFullStats)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          {showFullStats ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {showFullStats ? 'Masquer les statistiques' : 'Afficher les statistiques détaillées'}
        </button>
        <DashboardStats
          stats={stats}
          globalProgress={globalProgress}
          globalStats={globalStats}
          collapsed={!showFullStats}
        />
      </div>

      {renderTaskView()}
    </div>
  );
}
