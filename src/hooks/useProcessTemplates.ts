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

      // Fetch task templates + per-process manage permission
      const processesWithTasks: ProcessWithTasks[] = await Promise.all(
        (processData || []).map(async (process) => {
          const [{ data: tasks }, { data: canManageData }] = await Promise.all([
            supabase
              .from('task_templates')
              .select('*')
              .eq('process_template_id', process.id)
              .order('order_index', { ascending: true }),
            supabase.rpc('can_manage_template', { _creator_id: process.user_id }),
          ]);

          return {
            ...process,
            task_templates: (tasks || []) as TaskTemplate[],
            can_manage: Boolean(canManageData),
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

  const addProcess = async (
    process: Omit<ProcessTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
    visibilityCompanyIds?: string[],
    visibilityDepartmentIds?: string[]
  ) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('process_templates')
        .insert({ ...process, user_id: user.id })
        .select()
        .single();

      if (error) throw error;

      // Save visibility associations if provided
      if (data && (visibilityCompanyIds?.length || visibilityDepartmentIds?.length)) {
        const { saveTemplateVisibility } = await import('./useTemplateVisibility');
        await saveTemplateVisibility('process', data.id, visibilityCompanyIds || [], visibilityDepartmentIds || []);
      }

      setProcesses(prev => [{ ...data, task_templates: [], can_manage: true }, ...prev]);
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

  const duplicateProcess = async (processId: string) => {
    if (!user) return;

    try {
      // Fetch the process to duplicate
      const { data: originalProcess, error: fetchError } = await supabase
        .from('process_templates')
        .select('*')
        .eq('id', processId)
        .single();

      if (fetchError || !originalProcess) throw fetchError;

      // Create the duplicated process
      const { data: newProcess, error: createError } = await supabase
        .from('process_templates')
        .insert({
          name: `${originalProcess.name} (copie)`,
          description: originalProcess.description,
          company: originalProcess.company,
          department: originalProcess.department,
          visibility_level: originalProcess.visibility_level,
          is_shared: originalProcess.is_shared,
          creator_company_id: originalProcess.creator_company_id,
          creator_department_id: originalProcess.creator_department_id,
          user_id: user.id,
        })
        .select()
        .single();

      if (createError || !newProcess) throw createError;

      // Duplicate visibility associations
      const [{ data: visibleCompanies }, { data: visibleDepartments }] = await Promise.all([
        supabase.from('process_template_visible_companies').select('company_id').eq('process_template_id', processId),
        supabase.from('process_template_visible_departments').select('department_id').eq('process_template_id', processId),
      ]);

      if (visibleCompanies?.length) {
        await supabase.from('process_template_visible_companies').insert(
          visibleCompanies.map((vc) => ({ process_template_id: newProcess.id, company_id: vc.company_id }))
        );
      }
      if (visibleDepartments?.length) {
        await supabase.from('process_template_visible_departments').insert(
          visibleDepartments.map((vd) => ({ process_template_id: newProcess.id, department_id: vd.department_id }))
        );
      }

      // Fetch and duplicate sub-processes
      const { data: subProcesses } = await supabase
        .from('sub_process_templates')
        .select('*')
        .eq('process_template_id', processId);

      const subProcessIdMap: Record<string, string> = {};

      for (const sp of subProcesses || []) {
        const { data: newSp } = await supabase
          .from('sub_process_templates')
          .insert({
            name: sp.name,
            description: sp.description,
            assignment_type: sp.assignment_type,
            order_index: sp.order_index,
            visibility_level: sp.visibility_level,
            is_shared: sp.is_shared,
            process_template_id: newProcess.id,
            target_assignee_id: sp.target_assignee_id,
            target_department_id: sp.target_department_id,
            target_job_title_id: sp.target_job_title_id,
            creator_company_id: sp.creator_company_id,
            creator_department_id: sp.creator_department_id,
            user_id: user.id,
          })
          .select()
          .single();

        if (newSp) {
          subProcessIdMap[sp.id] = newSp.id;
        }
      }

      // Fetch and duplicate task templates
      const { data: taskTemplates } = await supabase
        .from('task_templates')
        .select('*')
        .eq('process_template_id', processId);

      for (const task of taskTemplates || []) {
        const newSubProcessId = task.sub_process_template_id ? subProcessIdMap[task.sub_process_template_id] : null;

        const { data: newTask } = await supabase
          .from('task_templates')
          .insert({
            title: task.title,
            description: task.description,
            priority: task.priority,
            default_duration_days: task.default_duration_days,
            order_index: task.order_index,
            visibility_level: task.visibility_level,
            is_shared: task.is_shared,
            requires_validation: task.requires_validation,
            process_template_id: newProcess.id,
            sub_process_template_id: newSubProcessId,
            category: task.category,
            category_id: task.category_id,
            subcategory_id: task.subcategory_id,
            creator_company_id: task.creator_company_id,
            creator_department_id: task.creator_department_id,
            user_id: user.id,
          })
          .select()
          .single();

        // Duplicate checklists
        if (newTask) {
          const { data: checklists } = await supabase
            .from('task_template_checklists')
            .select('*')
            .eq('task_template_id', task.id);

          if (checklists?.length) {
            await supabase.from('task_template_checklists').insert(
              checklists.map((cl) => ({
                title: cl.title,
                order_index: cl.order_index,
                task_template_id: newTask.id,
              }))
            );
          }
        }
      }

      await fetchProcesses();
      toast.success('Processus dupliqué avec succès');
      return newProcess;
    } catch (error) {
      console.error('Error duplicating process:', error);
      toast.error('Erreur lors de la duplication');
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
    duplicateProcess,
    addTaskTemplate,
    deleteTaskTemplate,
    refetch: fetchProcesses,
  };
}
