import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SubProcessTemplate, TaskTemplate, SubProcessWithTasks } from '@/types/template';
import { toast } from 'sonner';

export function useSubProcessTemplates(processId: string | null) {
  const { user } = useAuth();
  const [subProcesses, setSubProcesses] = useState<SubProcessWithTasks[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSubProcesses = useCallback(async () => {
    if (!processId) {
      setSubProcesses([]);
      return;
    }
    
    setIsLoading(true);
    try {
      const { data: subProcessData, error: subProcessError } = await supabase
        .from('sub_process_templates')
        .select('*')
        .eq('process_template_id', processId)
        .order('order_index', { ascending: true });

      if (subProcessError) throw subProcessError;

      // Fetch task templates for each sub-process
      const subProcessesWithTasks: SubProcessWithTasks[] = await Promise.all(
        (subProcessData || []).map(async (subProcess) => {
          const { data: tasks } = await supabase
            .from('task_templates')
            .select('*')
            .eq('sub_process_template_id', subProcess.id)
            .order('order_index', { ascending: true });

          return {
            ...subProcess,
            assignment_type: subProcess.assignment_type as 'manager' | 'user' | 'role',
            task_templates: (tasks || []) as TaskTemplate[],
          };
        })
      );

      setSubProcesses(subProcessesWithTasks);
    } catch (error) {
      console.error('Error fetching sub-processes:', error);
      toast.error('Erreur lors du chargement des sous-processus');
    } finally {
      setIsLoading(false);
    }
  }, [processId]);

  const addSubProcess = async (
    subProcess: Omit<SubProcessTemplate, 'id' | 'user_id' | 'process_template_id' | 'created_at' | 'updated_at'>
  ) => {
    if (!user || !processId) return;

    try {
      const { data, error } = await supabase
        .from('sub_process_templates')
        .insert({ 
          ...subProcess, 
          user_id: user.id,
          process_template_id: processId 
        })
        .select()
        .single();

      if (error) throw error;

      const newSubProcess: SubProcessWithTasks = {
        ...data,
        assignment_type: data.assignment_type as 'manager' | 'user' | 'role',
        task_templates: [],
      };

      setSubProcesses(prev => [...prev, newSubProcess]);
      toast.success('Sous-processus créé avec succès');
      return data;
    } catch (error) {
      console.error('Error adding sub-process:', error);
      toast.error('Erreur lors de la création du sous-processus');
    }
  };

  const updateSubProcess = async (id: string, updates: Partial<SubProcessTemplate>) => {
    try {
      const { error } = await supabase
        .from('sub_process_templates')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setSubProcesses(prev => 
        prev.map(sp => sp.id === id ? { ...sp, ...updates } : sp)
      );
      toast.success('Sous-processus mis à jour');
    } catch (error) {
      console.error('Error updating sub-process:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const deleteSubProcess = async (id: string) => {
    try {
      const { error } = await supabase
        .from('sub_process_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSubProcesses(prev => prev.filter(sp => sp.id !== id));
      toast.success('Sous-processus supprimé');
    } catch (error) {
      console.error('Error deleting sub-process:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const addTaskToSubProcess = async (
    subProcessId: string,
    task: Omit<TaskTemplate, 'id' | 'user_id' | 'process_template_id' | 'sub_process_template_id' | 'created_at' | 'updated_at'>
  ) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('task_templates')
        .insert({ 
          ...task, 
          user_id: user.id,
          sub_process_template_id: subProcessId,
          process_template_id: processId 
        })
        .select()
        .single();

      if (error) throw error;

      setSubProcesses(prev => 
        prev.map(sp => {
          if (sp.id === subProcessId) {
            return {
              ...sp,
              task_templates: [...sp.task_templates, data as TaskTemplate],
            };
          }
          return sp;
        })
      );
      toast.success('Tâche ajoutée au sous-processus');
      return data;
    } catch (error) {
      console.error('Error adding task to sub-process:', error);
      toast.error('Erreur lors de l\'ajout de la tâche');
    }
  };

  const deleteTaskFromSubProcess = async (subProcessId: string, taskId: string) => {
    try {
      const { error } = await supabase
        .from('task_templates')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      setSubProcesses(prev => 
        prev.map(sp => {
          if (sp.id === subProcessId) {
            return {
              ...sp,
              task_templates: sp.task_templates.filter(t => t.id !== taskId),
            };
          }
          return sp;
        })
      );
      toast.success('Tâche supprimée');
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  return {
    subProcesses,
    isLoading,
    fetchSubProcesses,
    addSubProcess,
    updateSubProcess,
    deleteSubProcess,
    addTaskToSubProcess,
    deleteTaskFromSubProcess,
  };
}
