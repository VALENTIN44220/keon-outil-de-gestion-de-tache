import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Task } from '@/types/task';
import { addDays, format } from 'date-fns';

interface GenerateTasksOptions {
  parentRequestId: string;
  processTemplateId: string;
  targetDepartmentId: string;
  subProcessTemplateId?: string;
}

export function useRequestWorkflow() {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  /**
   * Generate tasks from a process template when a request is created
   */
  const generateTasksFromProcess = async (options: GenerateTasksOptions): Promise<Task[]> => {
    const { parentRequestId, processTemplateId, targetDepartmentId, subProcessTemplateId } = options;

    if (!user) return [];

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
        return [];
      }

      const today = new Date();
      const createdTasks: Task[] = [];

      // Create each task from template
      for (const template of taskTemplates) {
        const dueDate = template.default_duration_days
          ? format(addDays(today, template.default_duration_days), 'yyyy-MM-dd')
          : null;

        const { data: newTask, error: taskError } = await supabase
          .from('tasks')
          .insert({
            title: template.title,
            description: template.description,
            priority: template.priority,
            status: 'todo',
            type: 'task',
            category: template.category,
            category_id: template.category_id,
            subcategory_id: template.subcategory_id,
            due_date: dueDate,
            user_id: user.id,
            target_department_id: targetDepartmentId,
            parent_request_id: parentRequestId,
            source_process_template_id: processTemplateId,
            source_sub_process_template_id: subProcessTemplateId || null,
            requires_validation: template.requires_validation || false,
            assignee_id: null, // Will be assigned by manager
          })
          .select()
          .single();

        if (taskError) {
          console.error('Error creating task from template:', taskError);
          continue;
        }

        createdTasks.push(newTask as Task);

        // Copy checklist items from template
        const { data: templateChecklists } = await supabase
          .from('task_template_checklists')
          .select('*')
          .eq('task_template_id', template.id);

        if (templateChecklists && templateChecklists.length > 0) {
          await supabase.from('task_checklists').insert(
            templateChecklists.map((item) => ({
              task_id: newTask.id,
              title: item.title,
              order_index: item.order_index,
            }))
          );
        }

        // Copy validation levels from template
        if (template.requires_validation) {
          const { data: templateValidationLevels } = await supabase
            .from('template_validation_levels')
            .select('*')
            .eq('task_template_id', template.id);

          if (templateValidationLevels && templateValidationLevels.length > 0) {
            await supabase.from('task_validation_levels').insert(
              templateValidationLevels.map((level) => ({
                task_id: newTask.id,
                level: level.level,
                validator_id: level.validator_profile_id,
                validator_department_id: level.validator_department_id,
                status: 'pending',
              }))
            );
          }
        }
      }

      // Create the assignment task for the manager
      if (createdTasks.length > 0) {
        const { data: parentRequest } = await supabase
          .from('tasks')
          .select('title')
          .eq('id', parentRequestId)
          .single();

        await supabase.from('tasks').insert({
          title: `Affecter les tâches: ${parentRequest?.title || 'Demande'}`,
          description: `${createdTasks.length} tâche(s) à affecter suite à la demande.\n\nTâches à affecter:\n${createdTasks.map(t => `- ${t.title}`).join('\n')}`,
          priority: 'high',
          status: 'todo',
          type: 'task',
          user_id: user.id,
          target_department_id: targetDepartmentId,
          parent_request_id: parentRequestId,
          is_assignment_task: true,
          assignee_id: null, // Will be picked up by manager with permissions
        });
      }

      toast({
        title: 'Processus déclenché',
        description: `${createdTasks.length} tâche(s) créée(s) à partir du modèle`,
      });

      return createdTasks;
    } catch (error) {
      console.error('Error generating tasks from process:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de générer les tâches du processus',
        variant: 'destructive',
      });
      return [];
    }
  };

  /**
   * Get the process template ID for a subcategory
   */
  const getProcessTemplateForSubcategory = async (subcategoryId: string): Promise<string | null> => {
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
    generateTasksFromProcess,
    getProcessTemplateForSubcategory,
  };
}
