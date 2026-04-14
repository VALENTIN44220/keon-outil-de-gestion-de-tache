import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { reassignmentStakeholderPatchForActingProfile } from '@/lib/reassignmentStakeholderUpdate';
import { Task } from '@/types/task';
import { useToast } from '@/hooks/use-toast';

interface UseUnassignedTasksResult {
  unassignedTasks: Task[];
  isLoading: boolean;
  assignTask: (taskId: string, assigneeId: string) => Promise<void>;
  refetch: () => Promise<void>;
  count: number;
}

export function useUnassignedTasks(): UseUnassignedTasksResult {
  const { user, profile: authProfile } = useAuth();
  const { getActiveProfile } = useSimulation();
  const profile = getActiveProfile() || authProfile;
  const { toast } = useToast();
  const [unassignedTasks, setUnassignedTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUnassignedTasks = useCallback(async () => {
    if (!user || !profile?.department_id) {
      setUnassignedTasks([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch tasks that are unassigned and targeted at the user's department
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .is('assignee_id', null)
        .eq('target_department_id', profile.department_id)
        .eq('is_assignment_task', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUnassignedTasks((data || []) as Task[]);
    } catch (error: any) {
      if (error?.message?.includes('AbortError') || error?.code === '20') {
        return;
      }
      console.error('Error fetching unassigned tasks:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les tâches à affecter useUnassignedTasks.ts',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, profile, toast]);

  useEffect(() => {
    fetchUnassignedTasks();
  }, [fetchUnassignedTasks]);

  const assignTask = async (taskId: string, assigneeId: string) => {
    try {
      const { data: row, error: fetchErr } = await supabase
        .from('tasks')
        .select('assignee_id, reassignment_stakeholder_id')
        .eq('id', taskId)
        .maybeSingle();
      if (fetchErr) throw fetchErr;

      const updates: Record<string, string> = { assignee_id: assigneeId };
      Object.assign(
        updates,
        reassignmentStakeholderPatchForActingProfile(
          profile?.id,
          row?.assignee_id ?? null,
          assigneeId,
          row?.reassignment_stakeholder_id ?? null
        )
      );

      const { error } = await supabase.from('tasks').update(updates).eq('id', taskId);

      if (error) throw error;

      setUnassignedTasks(prev => prev.filter(t => t.id !== taskId));
      toast({
        title: 'Tâche affectée',
        description: 'La tâche a été assignée avec succès',
      });
    } catch (error) {
      console.error('Error assigning task:', error);
      toast({
        title: 'Erreur',
        description: "Impossible d'affecter la tâche",
        variant: 'destructive',
      });
    }
  };

  return {
    unassignedTasks,
    isLoading,
    assignTask,
    refetch: fetchUnassignedTasks,
    count: unassignedTasks.length,
  };
}
