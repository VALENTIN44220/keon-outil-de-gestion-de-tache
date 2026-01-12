import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Task } from '@/types/task';

interface GeneratePendingAssignmentsOptions {
  parentRequestId: string;
  processTemplateId: string;
  targetDepartmentId: string;
  subProcessTemplateId?: string;
}

export function useRequestWorkflow() {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  /**
   * Generate pending task assignments from a process template when a request is created.
   * Tasks are NOT created immediately - they are stored as pending assignments
   * that the manager will assign to team members.
   */
  const generatePendingAssignments = async (
    options: GeneratePendingAssignmentsOptions
  ): Promise<number> => {
    const { parentRequestId, processTemplateId, targetDepartmentId, subProcessTemplateId } = options;

    if (!user) return 0;

    try {
      let taskTemplates: any[] = [];

      // If sub-process is specified, fetch tasks from sub-process
      if (subProcessTemplateId) {
        const { data, error } = await supabase
          .from('task_templates')
          .select('*')
          .eq('sub_process_template_id', subProcessTemplateId)
          .order('order_index', { ascending: true });

        if (error) throw error;
        taskTemplates = data || [];
      }

      // If no tasks from sub-process or no sub-process, try process level
      if (taskTemplates.length === 0) {
        const { data, error } = await supabase
          .from('task_templates')
          .select('*')
          .eq('process_template_id', processTemplateId)
          .is('sub_process_template_id', null)
          .order('order_index', { ascending: true });

        if (error) throw error;
        taskTemplates = data || [];
      }

      if (taskTemplates.length === 0) {
        return 0;
      }

      // Create pending assignments for each task template
      const pendingAssignments = taskTemplates.map((template) => ({
        request_id: parentRequestId,
        task_template_id: template.id,
        process_template_id: processTemplateId,
        sub_process_template_id: subProcessTemplateId || null,
        status: 'pending',
      }));

      const { error: insertError } = await supabase
        .from('pending_task_assignments' as any)
        .insert(pendingAssignments);

      if (insertError) throw insertError;

      // Create the assignment task for the manager notification
      const { data: parentRequest } = await supabase
        .from('tasks')
        .select('title')
        .eq('id', parentRequestId)
        .single();

      await supabase.from('tasks').insert({
        title: `Affecter les tâches: ${parentRequest?.title || 'Demande'}`,
        description: `${taskTemplates.length} tâche(s) à affecter suite à la demande.\n\nTâches à affecter:\n${taskTemplates.map((t) => `- ${t.title}`).join('\n')}`,
        priority: 'high',
        status: 'todo',
        type: 'task',
        user_id: user.id,
        target_department_id: targetDepartmentId,
        parent_request_id: parentRequestId,
        is_assignment_task: true,
        assignee_id: null, // Will be picked up by manager with permissions
      });

      toast({
        title: 'Demande créée',
        description: `${taskTemplates.length} tâche(s) en attente d'affectation par le responsable`,
      });

      return taskTemplates.length;
    } catch (error) {
      console.error('Error generating pending assignments:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de générer les affectations en attente',
        variant: 'destructive',
      });
      return 0;
    }
  };

  /**
   * Get the process template ID for a subcategory
   */
  const getProcessTemplateForSubcategory = async (
    subcategoryId: string
  ): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('subcategories')
        .select('default_process_template_id')
        .eq('id', subcategoryId)
        .single();

      if (error) throw error;
      return data?.default_process_template_id || null;
    } catch (error) {
      console.error('Error getting process template for subcategory:', error);
      return null;
    }
  };

  return {
    generatePendingAssignments,
    getProcessTemplateForSubcategory,
  };
}
