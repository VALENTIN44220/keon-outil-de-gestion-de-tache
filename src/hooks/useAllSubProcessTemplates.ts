import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SubProcessWithTasks, TaskTemplate } from '@/types/template';
import { toast } from 'sonner';

export function useAllSubProcessTemplates() {
  const { user } = useAuth();
  const [subProcesses, setSubProcesses] = useState<SubProcessWithTasks[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubProcesses = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data: subProcessData, error } = await supabase
        .from('sub_process_templates')
        .select(`
          *,
          process_templates (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const subProcessesWithTasks: SubProcessWithTasks[] = await Promise.all(
        (subProcessData || []).map(async (sp) => {
          const [{ data: tasks }, { data: canManageData }] = await Promise.all([
            supabase
              .from('task_templates')
              .select('*')
              .eq('sub_process_template_id', sp.id)
              .order('order_index', { ascending: true }),
            supabase.rpc('can_manage_template', { _creator_id: sp.user_id }),
          ]);

          return {
            ...sp,
            assignment_type: sp.assignment_type as 'manager' | 'user' | 'role',
            task_templates: (tasks || []) as TaskTemplate[],
            can_manage: Boolean(canManageData),
            process_name: (sp as any).process_templates?.name || null,
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
  }, [user]);

  useEffect(() => {
    fetchSubProcesses();
  }, [fetchSubProcesses]);

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

  const duplicateSubProcess = async (subProcessId: string) => {
    if (!user) return;

    try {
      const { data: original, error: fetchError } = await supabase
        .from('sub_process_templates')
        .select('*')
        .eq('id', subProcessId)
        .single();

      if (fetchError || !original) throw fetchError;

      const { data: newSp, error: createError } = await supabase
        .from('sub_process_templates')
        .insert({
          name: `${original.name} (copie)`,
          description: original.description,
          assignment_type: original.assignment_type,
          order_index: original.order_index,
          visibility_level: original.visibility_level,
          is_shared: original.is_shared,
          process_template_id: original.process_template_id,
          target_assignee_id: original.target_assignee_id,
          target_department_id: original.target_department_id,
          target_job_title_id: original.target_job_title_id,
          creator_company_id: original.creator_company_id,
          creator_department_id: original.creator_department_id,
          user_id: user.id,
        })
        .select()
        .single();

      if (createError || !newSp) throw createError;

      // Duplicate visibility associations
      const [{ data: visibleCompanies }, { data: visibleDepartments }] = await Promise.all([
        supabase.from('sub_process_template_visible_companies').select('company_id').eq('sub_process_template_id', subProcessId),
        supabase.from('sub_process_template_visible_departments').select('department_id').eq('sub_process_template_id', subProcessId),
      ]);

      if (visibleCompanies?.length) {
        await supabase.from('sub_process_template_visible_companies').insert(
          visibleCompanies.map((vc) => ({ sub_process_template_id: newSp.id, company_id: vc.company_id }))
        );
      }
      if (visibleDepartments?.length) {
        await supabase.from('sub_process_template_visible_departments').insert(
          visibleDepartments.map((vd) => ({ sub_process_template_id: newSp.id, department_id: vd.department_id }))
        );
      }

      // Duplicate task templates
      const { data: taskTemplates } = await supabase
        .from('task_templates')
        .select('*')
        .eq('sub_process_template_id', subProcessId);

      for (const task of taskTemplates || []) {
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
            process_template_id: newSp.process_template_id,
            sub_process_template_id: newSp.id,
            category: task.category,
            category_id: task.category_id,
            subcategory_id: task.subcategory_id,
            creator_company_id: task.creator_company_id,
            creator_department_id: task.creator_department_id,
            user_id: user.id,
          })
          .select()
          .single();

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

      await fetchSubProcesses();
      toast.success('Sous-processus dupliqué avec succès');
      return newSp;
    } catch (error) {
      console.error('Error duplicating sub-process:', error);
      toast.error('Erreur lors de la duplication');
    }
  };

  return {
    subProcesses,
    isLoading,
    refetch: fetchSubProcesses,
    deleteSubProcess,
    duplicateSubProcess,
  };
}
