import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { insertPendingAssignmentTasksForLane } from '@/lib/insertPendingAssignmentTasksForLane';
import { resolveSecondaryEcheanceLaneFromForm } from '@/lib/resolveSecondaryEcheanceLaneFromForm';
// TODO (désactivé) — team_lead_reassignment : décommentez quand la feature est réactivée
// import { fetchProcessAssignmentSettings, pickAssignmentRuleIdForPendingTask } from '@/lib/processAssignmentConfig';
// import { resolveWfAssignmentRuleToProfileId } from '@/lib/resolveWfAssignmentRuleToProfile';

interface GeneratePendingAssignmentsOptions {
  parentRequestId: string;
  processTemplateId: string;
  targetDepartmentId: string;
  subProcessTemplateId?: string;
  targetManagerId?: string;
  /** Valeurs du formulaire de demande (pour câbler échéance / service secondaires). */
  customFieldValues?: Record<string, unknown> | null;
}

export function useRequestWorkflow() {
  const { user } = useAuth();
  const { toast } = useToast();

  /**
   * Generate pending task assignments from a process template when a request is created.
   * Tasks are NOT created immediately - they are stored as pending assignments
   * that the manager will assign to team members.
   *
   * Si le formulaire contient un couple « Service secondaire + Échéance secondaire », une deuxième
   * série de tâches est créée avec `target_department_id` et `due_date` issus de ce couple.
   */
  const generatePendingAssignments = useCallback(
    async (options: GeneratePendingAssignmentsOptions): Promise<number> => {
      const {
        parentRequestId,
        processTemplateId,
        targetDepartmentId,
        subProcessTemplateId,
        targetManagerId,
        customFieldValues,
      } = options;

      if (!user) return 0;

      try {
        let taskTemplates: any[] = [];

        if (subProcessTemplateId) {
          const { data, error } = await supabase
            .from('task_templates')
            .select('*')
            .eq('sub_process_template_id', subProcessTemplateId)
            .order('order_index', { ascending: true });

          if (error) throw error;
          taskTemplates = data || [];
        }

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

        let effectiveTargetManagerId = targetManagerId;
        let subProcessTargetDept: string | null = null;
        if (subProcessTemplateId) {
          const { data: spt } = await supabase
            .from('sub_process_templates')
            .select('target_manager_id, target_department_id')
            .eq('id', subProcessTemplateId)
            .maybeSingle();
          if (!effectiveTargetManagerId) {
            effectiveTargetManagerId = spt?.target_manager_id ?? undefined;
          }
          subProcessTargetDept = spt?.target_department_id ?? null;
        }

        const secondaryLane = await resolveSecondaryEcheanceLaneFromForm(supabase, {
          processTemplateId,
          subProcessTemplateId: subProcessTemplateId ?? null,
          customFieldValues: customFieldValues ?? null,
        });

        let secondaryAssigneeId: string | null = null;
        if (
          secondaryLane &&
          subProcessTargetDept &&
          secondaryLane.departmentId === subProcessTargetDept
        ) {
          secondaryAssigneeId = effectiveTargetManagerId ?? null;
        }

        /*
         * TODO (désactivé) — team_lead_reassignment
         * Lorsque la feature sera réactivée, récupérer ici `processAssignment` via
         * `fetchProcessAssignmentSettings(processTemplateId)`, résoudre la règle WF via
         * `pickAssignmentRuleIdForPendingTask` + `resolveWfAssignmentRuleToProfileId`, puis
         * insérer avec `status: 'todo'`, `assignee_id` = profil résolu, `allows_reassignment: true`.
         */

        const primaryCreated = await insertPendingAssignmentTasksForLane({
          userId: user.id,
          parentRequestId,
          processTemplateId,
          subProcessTemplateId: subProcessTemplateId || null,
          targetDepartmentId,
          assigneeId: effectiveTargetManagerId ?? null,
          parentRow,
          taskTemplates,
          lane: 'primary',
        });

        let secondaryCreated = 0;
        if (secondaryLane) {
          const redundant =
            secondaryLane.departmentId === targetDepartmentId &&
            secondaryLane.dueDateYmd === parentDue;
          if (!redundant) {
            secondaryCreated = await insertPendingAssignmentTasksForLane({
              userId: user.id,
              parentRequestId,
              processTemplateId,
              subProcessTemplateId: subProcessTemplateId || null,
              targetDepartmentId: secondaryLane.departmentId,
              assigneeId: secondaryAssigneeId,
              parentRow,
              taskTemplates,
              lane: 'secondary',
              secondaryDueYmd: secondaryLane.dueDateYmd,
              titleSuffix: ' — (service secondaire)',
            });
          }
        }

        const total = primaryCreated + secondaryCreated;

        toast({
          title: 'Demande créée',
          description:
            secondaryCreated > 0
              ? `${total} tâche(s) créées (${primaryCreated} voie principale, ${secondaryCreated} échéance secondaire), en attente d'affectation`
              : `${primaryCreated} tâche(s) créées et assignées au manager pour affectation`,
        });

        return total;
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
