import { supabase } from '@/integrations/supabase/client';
import { normalizeValidationLevel } from '@/lib/taskValidationUi';

export type PendingAssignmentLane = 'primary' | 'secondary';

export interface InsertPendingAssignmentTasksParams {
  userId: string;
  parentRequestId: string;
  processTemplateId: string;
  subProcessTemplateId: string | null;
  targetDepartmentId: string;
  assigneeId: string | null;
  parentRow: { due_date?: string | null; requester_id: string | null; reporter_id: string | null } | null;
  taskTemplates: any[];
  lane: PendingAssignmentLane;
  /** Obligatoire pour lane === 'secondary' : échéance dédiée au service secondaire. */
  secondaryDueYmd?: string | null;
  /** Suffixe de titre pour distinguer les tâches (ex. service secondaire). */
  titleSuffix?: string;
}

/**
 * Crée les tâches « à affecter » à partir des gabarits (une passe = une voie primaire ou secondaire).
 */
export async function insertPendingAssignmentTasksForLane(
  params: InsertPendingAssignmentTasksParams
): Promise<number> {
  const {
    userId,
    parentRequestId,
    processTemplateId,
    subProcessTemplateId,
    targetDepartmentId,
    assigneeId,
    parentRow,
    taskTemplates,
    lane,
    secondaryDueYmd,
    titleSuffix = '',
  } = params;

  const parentDue: string | null = parentRow?.due_date
    ? String(parentRow.due_date).split('T')[0]
    : null;

  const today = new Date();
  const y0 = today.getFullYear();
  const m0 = today.getMonth();
  const d0 = today.getDate();

  let created = 0;

  for (const template of taskTemplates) {
    const dueFromTemplate = template.default_duration_days
      ? (() => {
          const d = new Date(y0, m0, d0 + Number(template.default_duration_days));
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })()
      : null;

    const dueDate =
      lane === 'secondary'
        ? (secondaryDueYmd || dueFromTemplate)
        : (parentDue ?? dueFromTemplate);

    const title =
      lane === 'secondary' && titleSuffix
        ? `${template.title}${titleSuffix}`
        : template.title;

    const { data: newTask, error: taskError } = await supabase
      .from('tasks')
      .insert({
        title,
        description: template.description,
        priority: template.priority,
        status: 'to_assign' as const,
        type: 'task' as const,
        due_date: dueDate,
        user_id: userId,
        assignee_id: assigneeId,
        parent_request_id: parentRequestId,
        requester_id: parentRow?.requester_id ?? null,
        reporter_id: parentRow?.reporter_id ?? null,
        source_process_template_id: processTemplateId,
        source_sub_process_template_id: subProcessTemplateId,
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

    created += 1;

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

  return created;
}
