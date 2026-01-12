import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TaskTemplate } from '@/types/template';
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

  const duplicateTask = async (taskId: string) => {
    if (!user) return;

    try {
      const { data: original, error: fetchError } = await supabase
        .from('task_templates')
        .select('*')
        .eq('id', taskId)
        .single();

      if (fetchError || !original) throw fetchError;

      const { data: newTask, error: createError } = await supabase
        .from('task_templates')
        .insert({
          title: `${original.title} (copie)`,
          description: original.description,
          priority: original.priority,
          default_duration_days: original.default_duration_days,
          order_index: original.order_index,
          visibility_level: original.visibility_level,
          is_shared: original.is_shared,
          requires_validation: original.requires_validation,
          process_template_id: original.process_template_id,
          sub_process_template_id: original.sub_process_template_id,
          category: original.category,
          category_id: original.category_id,
          subcategory_id: original.subcategory_id,
          creator_company_id: original.creator_company_id,
          creator_department_id: original.creator_department_id,
          user_id: user.id,
        })
        .select()
        .single();

      if (createError || !newTask) throw createError;

      // Duplicate visibility associations
      const [{ data: visibleCompanies }, { data: visibleDepartments }] = await Promise.all([
        supabase.from('task_template_visible_companies').select('company_id').eq('task_template_id', taskId),
        supabase.from('task_template_visible_departments').select('department_id').eq('task_template_id', taskId),
      ]);

      if (visibleCompanies?.length) {
        await supabase.from('task_template_visible_companies').insert(
          visibleCompanies.map((vc) => ({ task_template_id: newTask.id, company_id: vc.company_id }))
        );
      }
      if (visibleDepartments?.length) {
        await supabase.from('task_template_visible_departments').insert(
          visibleDepartments.map((vd) => ({ task_template_id: newTask.id, department_id: vd.department_id }))
        );
      }

      // Duplicate checklists
      const { data: checklists } = await supabase
        .from('task_template_checklists')
        .select('*')
        .eq('task_template_id', taskId);

      if (checklists?.length) {
        await supabase.from('task_template_checklists').insert(
          checklists.map((cl) => ({
            title: cl.title,
            order_index: cl.order_index,
            task_template_id: newTask.id,
          }))
        );
      }

      await fetchTasks();
      toast.success('Tâche modèle dupliquée avec succès');
      return newTask;
    } catch (error) {
      console.error('Error duplicating task template:', error);
      toast.error('Erreur lors de la duplication');
    }
  };

  return {
    tasks,
    isLoading,
    refetch: fetchTasks,
    deleteTask,
    duplicateTask,
  };
}
