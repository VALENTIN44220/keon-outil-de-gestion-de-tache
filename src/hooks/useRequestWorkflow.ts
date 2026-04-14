import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { normalizeValidationLevel } from '@/lib/taskValidationUi';
// TODO (désactivé) — team_lead_reassignment : décommentez quand la feature est réactivée
// import { fetchProcessAssignmentSettings, pickAssignmentRuleIdForPendingTask } from '@/lib/processAssignmentConfig';
// import { resolveWfAssignmentRuleToProfileId } from '@/lib/resolveWfAssignmentRuleToProfile';

interface GeneratePendingAssignmentsOptions {
  parentRequestId: string;
  processTemplateId: string;
  targetDepartmentId: string;
  subProcessTemplateId?: string;
  targetManagerId?: string;
}

export function useRequestWorkflow() {
  const { user } = useAuth();
  const { toast } = useToast();

  /**
   * Generate pending task assignments from a process template when a request is created.
   * Tasks are NOT created immediately - they are stored as pending assignments
   * that the manager will assign to team members.
   */
  const generatePendingAssignments = useCallback(
    async (options: GeneratePendingAssignmentsOptions): Promise<number> => {
      const { parentRequestId, processTemplateId, targetDepartmentId, subProcessTemplateId, targetManagerId } = options;

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

        const { data: parentRow } = await supabase
          .from('tasks')
          .select('due_date, requester_id, reporter_id')
          .eq('id', parentRequestId)
          .maybeSingle();
        const parentDue: string | null = parentRow?.due_date
          ? String(parentRow.due_date).split('T')[0]
          : null;

        // Résoudre le manager effectif (depuis l'option passée ou depuis le template de sous-processus)
        let effectiveTargetManagerId = targetManagerId;
        if (!effectiveTargetManagerId && subProcessTemplateId) {
          const { data: spt } = await supabase
            .from('sub_process_templates')
            .select('target_manager_id')
            .eq('id', subProcessTemplateId)
            .maybeSingle();
          effectiveTargetManagerId = spt?.target_manager_id ?? undefined;
        }

        /*
         * TODO (désactivé) — team_lead_reassignment
         * Lorsque la feature sera réactivée, récupérer ici `processAssignment` via
         * `fetchProcessAssignmentSettings(processTemplateId)`, résoudre la règle WF via
         * `pickAssignmentRuleIdForPendingTask` + `resolveWfAssignmentRuleToProfileId`, puis
         * insérer avec `status: 'todo'`, `assignee_id` = profil résolu, `allows_reassignment: true`.
         */

        const today = new Date();
        const y0 = today.getFullYear();
        const m0 = today.getMonth();
        const d0 = today.getDate();

        for (const template of taskTemplates) {
          const dueFromTemplate = template.default_duration_days
            ? (() => {
                const d = new Date(y0, m0, d0 + Number(template.default_duration_days));
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              })()
            : null;
          // Échéance de la demande parente (saisie à la création) : sinon délai par défaut du gabarit.
          const dueDate = parentDue ?? dueFromTemplate;

          const { data: newTask, error: taskError } = await supabase
            .from('tasks')
            .insert({
              title: template.title,
              description: template.description,
              priority: template.priority,
              status: 'to_assign' as const,
              type: 'task' as const,
              due_date: dueDate,
              user_id: user.id,
              assignee_id: effectiveTargetManagerId || null,
              parent_request_id: parentRequestId,
              requester_id: parentRow?.requester_id ?? null,
              reporter_id: parentRow?.reporter_id ?? null,
              source_process_template_id: processTemplateId,
              source_sub_process_template_id: subProcessTemplateId || null,
              target_department_id: targetDepartmentId,
              requires_validation: template.requires_validation || false,
              validation_level_1: normalizeValidationLevel(template.validation_level_1),
              validation_level_2: normalizeValidationLevel(template.validation_level_2),
              validator_level_1_id: template.validator_level_1_id ?? null,
              validator_level_2_id: template.validator_level_2_id ?? null,
              is_assignment_task: false,
            })
            .select()
            .single();

          if (taskError) {
            console.error('Error creating task:', taskError);
            continue;
          }

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

          // Copy validation levels if required
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

        toast({
          title: 'Demande créée',
          description: `${taskTemplates.length} tâche(s) créées et assignées au manager pour affectation`,
        });

        return taskTemplates.length;
      } catch (error) {
        console.error('Error generating pending assignments:', error);
        toast({
          title: 'Erreur',
          description: "Impossible de générer les affectations en attente",
          variant: 'destructive',
        });
        return 0;
      }
    },
    [toast, user]
  );

  /**
   * Get the process template ID for a subcategory
   */
  const getProcessTemplateForSubcategory = useCallback(async (subcategoryId: string): Promise<string | null> => {
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
  }, []);

  return {
    generatePendingAssignments,
    getProcessTemplateForSubcategory,
  };
}
