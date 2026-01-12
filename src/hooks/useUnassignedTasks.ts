import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
  const { user, profile } = useAuth();
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
    } catch (error) {
      console.error('Error fetching unassigned tasks:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les tâches à affecter',
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
      const { error } = await supabase
        .from('tasks')
        .update({ assignee_id: assigneeId })
        .eq('id', taskId);

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
