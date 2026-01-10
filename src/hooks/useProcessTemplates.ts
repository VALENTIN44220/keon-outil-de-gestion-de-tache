import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ProcessTemplate, TaskTemplate, ProcessWithTasks } from '@/types/template';
import { toast } from 'sonner';

export function useProcessTemplates() {
  const { user } = useAuth();
  const [processes, setProcesses] = useState<ProcessWithTasks[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

  const fetchProcesses = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      let query = supabase
        .from('process_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (companyFilter !== 'all') {
        query = query.eq('company', companyFilter);
      }
      if (departmentFilter !== 'all') {
        query = query.eq('department', departmentFilter);
      }

      const { data: processData, error: processError } = await query;

      if (processError) throw processError;

      // Fetch task templates for each process
      const processesWithTasks: ProcessWithTasks[] = await Promise.all(
        (processData || []).map(async (process) => {
          const { data: tasks } = await supabase
            .from('task_templates')
            .select('*')
            .eq('process_template_id', process.id)
            .order('order_index', { ascending: true });

          return {
            ...process,
            task_templates: (tasks || []) as TaskTemplate[],
          };
        })
      );

      setProcesses(processesWithTasks);
    } catch (error) {
      console.error('Error fetching processes:', error);
      toast.error('Erreur lors du chargement des processus');
    } finally {
      setIsLoading(false);
    }
  }, [user, companyFilter, departmentFilter]);

  useEffect(() => {
    fetchProcesses();
  }, [fetchProcesses]);

  const addProcess = async (process: Omit<ProcessTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('process_templates')
        .insert({ ...process, user_id: user.id })
        .select()
        .single();

      if (error) throw error;

      setProcesses(prev => [{ ...data, task_templates: [] }, ...prev]);
      toast.success('Processus créé avec succès');
      return data;
    } catch (error) {
      console.error('Error adding process:', error);
      toast.error('Erreur lors de la création du processus');
    }
  };

  const updateProcess = async (id: string, updates: Partial<ProcessTemplate>) => {
    try {
      const { error } = await supabase
        .from('process_templates')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setProcesses(prev => 
        prev.map(p => p.id === id ? { ...p, ...updates } : p)
      );
      toast.success('Processus mis à jour');
    } catch (error) {
      console.error('Error updating process:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const deleteProcess = async (id: string) => {
    try {
      const { error } = await supabase
        .from('process_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setProcesses(prev => prev.filter(p => p.id !== id));
      toast.success('Processus supprimé');
    } catch (error) {
      console.error('Error deleting process:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const addTaskTemplate = async (
    processId: string, 
    task: Omit<TaskTemplate, 'id' | 'user_id' | 'process_template_id' | 'created_at' | 'updated_at'>
  ) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('task_templates')
        .insert({ 
          ...task, 
          user_id: user.id,
          process_template_id: processId 
        })
        .select()
        .single();

      if (error) throw error;

      setProcesses(prev => 
        prev.map(p => {
          if (p.id === processId) {
            return {
              ...p,
              task_templates: [...p.task_templates, data as TaskTemplate],
            };
          }
          return p;
        })
      );
      toast.success('Tâche modèle ajoutée');
      return data;
    } catch (error) {
      console.error('Error adding task template:', error);
      toast.error('Erreur lors de l\'ajout de la tâche');
    }
  };

  const deleteTaskTemplate = async (processId: string, taskId: string) => {
    try {
      const { error } = await supabase
        .from('task_templates')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      setProcesses(prev => 
        prev.map(p => {
          if (p.id === processId) {
            return {
              ...p,
              task_templates: p.task_templates.filter(t => t.id !== taskId),
            };
          }
          return p;
        })
      );
      toast.success('Tâche modèle supprimée');
    } catch (error) {
      console.error('Error deleting task template:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  // Get unique companies and departments for filters
  const companies = [...new Set(processes.map(p => p.company).filter(Boolean))] as string[];
  const departments = [...new Set(processes.map(p => p.department).filter(Boolean))] as string[];

  return {
    processes,
    isLoading,
    companyFilter,
    setCompanyFilter,
    departmentFilter,
    setDepartmentFilter,
    companies,
    departments,
    addProcess,
    updateProcess,
    deleteProcess,
    addTaskTemplate,
    deleteTaskTemplate,
    refetch: fetchProcesses,
  };
}
