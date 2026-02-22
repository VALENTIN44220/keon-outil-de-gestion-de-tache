import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Task } from '@/types/task';

/**
 * Hook to fetch tasks pending validation for the current user.
 * A user sees tasks where they are the designated validator at the current pending level.
 */
export function usePendingTaskValidations() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPendingTaskValidations = useCallback(async () => {
    if (!profile?.id) return;

    setIsLoading(true);
    try {
      // Fetch tasks pending validation level 1 where current user is validator
      const { data: level1 } = await supabase
        .from('tasks')
        .select('*')
        .eq('type', 'task')
        .eq('status', 'pending_validation_1')
        .eq('validator_level_1_id', profile.id)
        .order('created_at', { ascending: false });

      // Fetch tasks pending validation level 2 where current user is validator
      const { data: level2 } = await supabase
        .from('tasks')
        .select('*')
        .eq('type', 'task')
        .eq('status', 'pending_validation_2')
        .eq('validator_level_2_id', profile.id)
        .order('created_at', { ascending: false });

      const all = [...(level1 || []), ...(level2 || [])] as Task[];
      const unique = Array.from(new Map(all.map(t => [t.id, t])).values());
      setTasks(unique);
    } catch (error) {
      console.error('Error fetching pending task validations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchPendingTaskValidations();
  }, [fetchPendingTaskValidations]);

  return {
    tasks,
    count: tasks.length,
    isLoading,
    refetch: fetchPendingTaskValidations,
  };
}
