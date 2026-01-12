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

  return {
    subProcesses,
    isLoading,
    refetch: fetchSubProcesses,
    deleteSubProcess,
  };
}
