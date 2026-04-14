import { useState, useMemo, useEffect, useCallback } from 'react';
import { Task, TaskStatus, TaskPriority, TaskStats } from '@/types/task';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { useToast } from '@/hooks/use-toast';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { useTeamHierarchy } from '@/hooks/useTeamHierarchy';
import { TaskScope } from '@/hooks/useTaskScope';

function sortTasksNewestFirst(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );
}

function mergeTasksDedupeById(primary: Task[], extra: Task[]): Task[] {
  // Même id dans les deux listes : fusionner (ex. ligne « équipe » chargée sans reassignment_stakeholder_id
  // puis ligne stakeholder plus à jour, ou l’inverse).
  const byId = new Map<string, Task>();
  for (const t of primary) {
    byId.set(t.id, t);
  }
  for (const t of extra) {
    const existing = byId.get(t.id);
    if (!existing) {
      byId.set(t.id, t);
    } else {
      byId.set(t.id, { ...existing, ...t });
    }
  }
  return sortTasksNewestFirst(Array.from(byId.values()));
}

/**
 * Tâches où l'utilisateur suit après une réaffectation.
 * Si la colonne n'existe pas encore (migration non appliquée), retourne [] sans casser le chargement principal.
 */
async function fetchTasksAsStakeholder(profileId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('type', 'task')
    .eq('reassignment_stakeholder_id', profileId)
    .order('created_at', { ascending: false });

  if (error) {
    const m = error.message?.toLowerCase() ?? '';
    if (
      m.includes('column') ||
      m.includes('does not exist') ||
      m.includes('schema cache') ||
      error.code === '42703'
    ) {
      return [];
    }
    console.warn('fetchTasksAsStakeholder:', error);
    return [];
  }
  return (data || []) as Task[];
}

export function useTasks(externalScope?: TaskScope) {
  const { user, profile: authProfile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const { toast } = useToast();
  const { effectivePermissions, isLoading: permissionsLoading } = useEffectivePermissions();
  const { subordinates } = useTeamHierarchy();
  
  // Use simulated profile if in simulation mode
  const profile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [scope, setScope] = useState<TaskScope>(externalScope || 'my_tasks');

  // Update internal scope when external changes
  useEffect(() => {
    if (externalScope) {
      setScope(externalScope);
    }
  }, [externalScope]);

  // Get team member IDs (self + subordinates)
  const myTeamIds = useMemo(() => {
    if (!profile?.id) return [];
    const ids = [profile.id];
    subordinates.forEach(sub => ids.push(sub.id));
    return ids;
  }, [profile?.id, subordinates]);

  const fetchTasks = useCallback(async () => {
    if (!user || !profile || permissionsLoading) {
      if (!user) {
        setTasks([]);
      }
      if (!user || !profile) {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);

    const withStakeholder = async (primary: Task[]): Promise<Task[]> => {
      const extra = await fetchTasksAsStakeholder(profile.id);
      return extra.length ? mergeTasksDedupeById(primary, extra) : primary;
    };

    let query = supabase
      .from('tasks')
      .select('*')
      .eq('type', 'task')
      .order('created_at', { ascending: false });

    switch (scope) {
      case 'my_tasks':
        query = query.eq('assignee_id', profile.id);
        break;

      case 'department_tasks':
        // Uniquement les tâches dont l'exécutant est dans l'équipe (soi + hiérarchie).
        // Les files « par service » (target_department_id) restent dans les vues « À affecter » / affectation.
        if (effectivePermissions.can_view_subordinates_tasks || effectivePermissions.can_view_all_tasks) {
          if (myTeamIds.length > 0) {
            query = query.in('assignee_id', myTeamIds);
          } else {
            query = query.eq('assignee_id', profile.id);
          }
        } else {
          query = query.eq('assignee_id', profile.id);
        }
        break;

      case 'all_tasks':
        if (!effectivePermissions.can_view_all_tasks) {
          if (effectivePermissions.can_view_subordinates_tasks && myTeamIds.length > 0) {
            query = query.in('assignee_id', myTeamIds);
          } else {
            query = query.eq('assignee_id', profile.id);
          }
        }
        break;

      default:
        query = query.eq('assignee_id', profile.id);
    }

    const { data, error } = await query;

    if (error) {
      if (error.message?.includes('AbortError') || error.code === '20') {
        setIsLoading(false);
        return;
      }
      console.error('Error fetching tasks:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les tâches useTasks.ts',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    let rows = (data || []) as Task[];

    // Suivi post-réaffectation : tâches où l’utilisateur est stakeholder (ex-manager) même si l’assigné n’est plus dans son équipe.
    if (scope === 'my_tasks') {
      rows = await withStakeholder(rows);
    } else if (
      scope === 'department_tasks' &&
      (effectivePermissions.can_view_subordinates_tasks || effectivePermissions.can_view_all_tasks)
    ) {
      rows = await withStakeholder(rows);
    } else if (
      scope === 'all_tasks' &&
      (effectivePermissions.can_view_all_tasks || effectivePermissions.can_view_subordinates_tasks)
    ) {
      rows = await withStakeholder(rows);
    }

    setTasks(sortTasksNewestFirst(rows));
    setIsLoading(false);
  }, [user, profile, toast, effectivePermissions, permissionsLoading, isSimulating, scope, myTeamIds]);

  useEffect(() => {
    if (!permissionsLoading) {
      fetchTasks();
    }
  }, [fetchTasks, permissionsLoading]);

  // Live-update task statuses without page refresh.
  useEffect(() => {
    if (!user?.id || !profile?.id) return;

    const channel = supabase
      .channel(`tasks-live-status-${scope}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: 'type=eq.task',
        },
        (payload: any) => {
          const updated = payload?.new;
          if (!updated?.id) return;
          setTasks((prev) =>
            prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, profile?.id, scope]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
      const matchesSearch = 
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        // Search by request number (D-XXX-XXXXX format)
        (task.request_number?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        // Search by task number (T-XXX-XXXX format)  
        (task.task_number?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      
      return matchesStatus && matchesPriority && matchesSearch;
    });
  }, [tasks, statusFilter, priorityFilter, searchQuery]);

  const stats: TaskStats = useMemo(() => {
    const total = tasks.length;
    const todo = tasks.filter(t => t.status === 'todo').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const done = tasks.filter(t => t.status === 'done').length;
    // Use helper function logic for pending validation
    const pendingValidation = tasks.filter(t => 
      t.status === 'pending_validation_1' || t.status === 'pending_validation_2'
    ).length;
    const validated = tasks.filter(t => t.status === 'validated').length;
    const refused = tasks.filter(t => t.status === 'refused').length;
    // Completion = done + validated (both are terminal states)
    const completionRate = total > 0 ? Math.round(((done + validated) / total) * 100) : 0;

    return { total, todo, inProgress, done, pendingValidation, validated, refused, completionRate };
  }, [tasks]);

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId);

    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour le statut',
        variant: 'destructive',
      });
    } else {
      setTasks(prev => 
        prev.map(task => 
          task.id === taskId 
            ? { ...task, status: newStatus, updated_at: new Date().toISOString() }
            : task
        )
      );
    }
  };

  const addTask = async (
    taskData: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
    checklistItems?: { id: string; title: string; order_index: number }[],
    links?: { id: string; name: string; url: string; type: 'link' | 'file' }[]
  ) => {
    if (!user) return;

    // Get the user's profile for requester_id
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        ...taskData,
        user_id: user.id,
        type: taskData.type || 'task',
        requester_id: taskData.requester_id || profileData?.id || null,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de créer la tâche useTasks.ts',
        variant: 'destructive',
      });
    } else {
      // Create checklist items if provided
      if (checklistItems && checklistItems.length > 0) {
        const checklistsToCreate = checklistItems.map(item => ({
          task_id: data.id,
          title: item.title,
          order_index: item.order_index,
        }));

        await supabase
          .from('task_checklists')
          .insert(checklistsToCreate);
      }

      // Create attachments/links if provided
      if (links && links.length > 0) {
        const attachmentsToCreate = links.map(link => ({
          task_id: data.id,
          name: link.name,
          url: link.url,
          type: link.type,
          uploaded_by: profileData?.id || null,
        }));

        await supabase
          .from('task_attachments')
          .insert(attachmentsToCreate);
      }

      setTasks(prev => [data as Task, ...prev]);
      toast({
        title: taskData.type === 'request' ? 'Demande créée' : 'Tâche créée',
        description: taskData.type === 'request' 
          ? 'La demande a été soumise avec succès'
          : 'La tâche a été ajoutée avec succès',
      });
    }
  };

  const deleteTask = async (taskId: string) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer la tâche',
        variant: 'destructive',
      });
    } else {
      setTasks(prev => prev.filter(task => task.id !== taskId));
      toast({
        title: 'Tâche supprimée',
        description: 'La tâche a été supprimée',
      });
    }
  };

  return {
    tasks: filteredTasks,
    allTasks: tasks,
    stats,
    isLoading,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    searchQuery,
    setSearchQuery,
    updateTaskStatus,
    addTask,
    deleteTask,
    refetch: fetchTasks,
    scope,
    setScope,
  };
}
