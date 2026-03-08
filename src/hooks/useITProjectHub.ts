import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ITProject, ITProjectMilestone } from '@/types/itProject';
import { Task } from '@/types/task';

export function useITProject(code: string | undefined) {
  return useQuery({
    queryKey: ['it-project', code],
    queryFn: async (): Promise<ITProject | null> => {
      if (!code) return null;
      const { data, error } = await supabase
        .from('it_projects')
        .select(`*, responsable_it:profiles!it_projects_responsable_it_id_fkey(id,display_name,avatar_url), chef_projet:profiles!it_projects_chef_projet_id_fkey(id,display_name,avatar_url), sponsor:profiles!it_projects_sponsor_id_fkey(id,display_name,avatar_url)`)
        .eq('code_projet_digital', code)
        .maybeSingle();
      if (error) throw error;
      return data as ITProject | null;
    },
    enabled: !!code,
  });
}

export function useITProjectTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: ['it-project-tasks', projectId],
    queryFn: async (): Promise<Task[]> => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('tasks')
        .select(`*, assignee:profiles!tasks_assignee_id_fkey(id,display_name,avatar_url), requester:profiles!tasks_requester_id_fkey(id,display_name,avatar_url)`)
        .eq('it_project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as Task[]) || [];
    },
    enabled: !!projectId,
  });
}

export function useITProjectMilestones(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['it-project-milestones', projectId],
    queryFn: async (): Promise<ITProjectMilestone[]> => {
      if (!projectId) return [];
      const { data, error } = await supabase.from('it_project_milestones').select('*').eq('it_project_id', projectId).order('ordre', { ascending: true });
      if (error) throw error;
      return (data as ITProjectMilestone[]) || [];
    },
    enabled: !!projectId,
  });
  const addMilestone = async (milestone: Omit<ITProjectMilestone, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase.from('it_project_milestones').insert(milestone).select().single();
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['it-project-milestones', projectId] });
    return data as ITProjectMilestone;
  };
  const updateMilestone = async (id: string, updates: Partial<ITProjectMilestone>) => {
    const { data, error } = await supabase.from('it_project_milestones').update(updates).eq('id', id).select().single();
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['it-project-milestones', projectId] });
    return data as ITProjectMilestone;
  };
  const deleteMilestone = async (id: string) => {
    const { error } = await supabase.from('it_project_milestones').delete().eq('id', id);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['it-project-milestones', projectId] });
  };
  return { ...query, addMilestone, updateMilestone, deleteMilestone };
}

export function useITProjectStats(tasks: Task[], project: ITProject | null | undefined) {
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => ['done', 'validated', 'closed'].includes(t.status)).length;
  const openTasks = totalTasks - doneTasks;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdueTasks = tasks.filter(t => {
    if (!t.due_date) return false;
    if (['done', 'validated', 'closed', 'cancelled'].includes(t.status)) return false;
    return new Date(t.due_date) < today;
  }).length;
  const progress = project?.progress !== undefined && project.progress !== null
    ? project.progress
    : totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const budgetRatio = project?.budget_previsionnel && project.budget_previsionnel > 0
    ? Math.round(((project.budget_consomme || 0) / project.budget_previsionnel) * 100)
    : null;
  return { totalTasks, openTasks, doneTasks, overdueTasks, progress, budgetRatio };
}
