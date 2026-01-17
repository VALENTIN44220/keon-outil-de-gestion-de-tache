import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TaskTemplate, ValidationLevelType } from '@/types/template';
import { toast } from 'sonner';

export interface TaskTemplateWithContext extends TaskTemplate {
  process_name?: string | null;
  sub_process_name?: string | null;
}

export function useAllTaskTemplates() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskTemplateWithContext[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data: taskData, error } = await supabase
        .from('task_templates')
        .select(`
          *,
          process_templates (
            id,
            name
          ),
          sub_process_templates (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const tasksWithContext: TaskTemplateWithContext[] = await Promise.all(
        (taskData || []).map(async (task) => {
          const { data: canManageData } = await supabase.rpc('can_manage_template', {
            _creator_id: task.user_id,
          });

          return {
            ...task,
            priority: task.priority as 'low' | 'medium' | 'high' | 'urgent',
            visibility_level: task.visibility_level as TaskTemplate['visibility_level'],
            validation_level_1: (task.validation_level_1 || 'none') as ValidationLevelType,
            validation_level_2: (task.validation_level_2 || 'none') as ValidationLevelType,
            process_name: (task as any).process_templates?.name || null,
            sub_process_name: (task as any).sub_process_templates?.name || null,
            can_manage: Boolean(canManageData),
          };
        })
      );

      setTasks(tasksWithContext);
    } catch (error) {
      console.error('Error fetching task templates:', error);
      toast.error('Erreur lors du chargement des tâches modèles');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const deleteTask = async (id: string) => {
    try {
      const { error } = await supabase
        .from('task_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTasks(prev => prev.filter(t => t.id !== id));
      toast.success('Tâche modèle supprimée');
    } catch (error) {
      console.error('Error deleting task template:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  return {
    tasks,
    isLoading,
    refetch: fetchTasks,
    deleteTask,
  };
}
