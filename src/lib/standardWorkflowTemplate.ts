/**
 * Standard workflow template generator.
 * Creates a default workflow structure based on simplified options.
 */
import type { WfStepInsert, WfTransitionInsert, WfNotificationInsert } from '@/types/workflow';
import type { WfTaskConfigInsert, WfValidationConfigInsert } from '@/types/workflowTaskConfig';

export interface StandardWorkflowOptions {
  request_validation: boolean;
  final_validation: boolean;
  assignment_mode: 'auto' | 'manual' | 'role' | 'manager';
  executor_type: 'specific_user' | 'requester' | 'requester_manager' | 'role' | 'manual' | 'field_value';
  executor_value: string | null;
  completion_behavior: 'close_task' | 'send_to_validation';
  enable_notifications: boolean;
  enable_auto_actions: boolean;
}

export const DEFAULT_STANDARD_OPTIONS: StandardWorkflowOptions = {
  request_validation: true,
  final_validation: false,
  assignment_mode: 'manual',
  executor_type: 'manual',
  executor_value: null,
  completion_behavior: 'close_task',
  enable_notifications: true,
  enable_auto_actions: false,
};

import type { Json } from '@/integrations/supabase/types';

interface GeneratedStep { step_key: string; name: string; step_type: string; order_index: number; state_label: string; is_required: boolean; validation_mode?: string; }
interface GeneratedTransition { from_step_key: string; to_step_key: string; event: string; }
interface GeneratedNotification { step_key: string; event: string; subject_template: string; body_template: string; channels_json: Json; recipients_rules_json: Json; is_active: boolean; }
interface GeneratedTask { name: string; task_key: string; step_key: string; executor_type: string; executor_value?: string | null; trigger_mode: string; initial_status: string; completion_behavior: string; is_active: boolean; is_required: boolean; order_index: number; assignment_mode: string; }
interface GeneratedValidation { name: string; validation_key: string; object_type: string; source_step_key: string; validator_type: string; on_approved_effect: string; on_rejected_effect: string; on_rejected_target_step_key?: string; is_active: boolean; order_index: number; validation_mode: string; }

export interface GeneratedStructure {
  steps: GeneratedStep[];
  transitions: GeneratedTransition[];
  notifications: GeneratedNotification[];
  taskConfigs: GeneratedTask[];
  validationConfigs: GeneratedValidation[];
}

export function generateStandardStructure(options: StandardWorkflowOptions): GeneratedStructure {
  const steps: GeneratedStep[] = [];
  const transitions: GeneratedTransition[] = [];
  const notifications: GeneratedNotification[] = [];
  const taskConfigs: GeneratedTask[] = [];
  const validationConfigs: GeneratedValidation[] = [];

  let orderIdx = 0;

  // 1. Start
  const startKey = 'std_start';
  steps.push({ step_key: startKey, name: 'Début', step_type: 'start', order_index: orderIdx++, state_label: 'Brouillon', is_required: true });

  // 2. Submitted
  const submittedKey = 'std_submitted';
  steps.push({ step_key: submittedKey, name: 'Soumise', step_type: 'request_creation', order_index: orderIdx++, state_label: 'Soumise', is_required: true });
  transitions.push({ from_step_key: startKey, to_step_key: submittedKey, event: 'done' });

  let lastKey = submittedKey;

  // 3. Request validation (optional)
  if (options.request_validation) {
    const valKey = 'std_validation_request';
    steps.push({ step_key: valKey, name: 'Validation de la demande', step_type: 'validation', order_index: orderIdx++, state_label: 'En attente de validation', is_required: true, validation_mode: 'simple' });
    transitions.push({ from_step_key: lastKey, to_step_key: valKey, event: 'done' });

    validationConfigs.push({
      name: 'Validation de la demande', validation_key: 'std_val_request', object_type: 'request',
      source_step_key: valKey, validator_type: 'requester_manager',
      on_approved_effect: 'advance_step', on_rejected_effect: 'goto_step',
      is_active: true, order_index: 0, validation_mode: 'simple',
    });

    const rejectedKey = 'std_rejected';
    steps.push({ step_key: rejectedKey, name: 'Rejetée', step_type: 'end', order_index: 900, state_label: 'Rejetée', is_required: false });
    transitions.push({ from_step_key: valKey, to_step_key: rejectedKey, event: 'rejected' });

    lastKey = valKey;
  }

  // 4. Assignment
  const assignKey = 'std_assignment';
  steps.push({ step_key: assignKey, name: 'Affectation', step_type: 'assignment', order_index: orderIdx++, state_label: 'À affecter', is_required: true });
  transitions.push({ from_step_key: lastKey, to_step_key: assignKey, event: options.request_validation ? 'approved' : 'done' });
  lastKey = assignKey;

  // 5. Execution
  const execKey = 'std_execution';
  steps.push({ step_key: execKey, name: 'Exécution', step_type: 'execution', order_index: orderIdx++, state_label: 'En cours', is_required: true });
  transitions.push({ from_step_key: lastKey, to_step_key: execKey, event: 'assigned' });

  taskConfigs.push({
    name: 'Tâche principale', task_key: 'std_main_task', step_key: execKey,
    executor_type: options.executor_type,
    executor_value: options.executor_value || null,
    trigger_mode: 'on_step_entry',
    initial_status: 'todo', completion_behavior: options.completion_behavior,
    is_active: true, is_required: true, order_index: 0, assignment_mode: 'direct',
  });

  lastKey = execKey;

  // 6. Final validation (optional)
  if (options.final_validation) {
    const finalValKey = 'std_validation_final';
    steps.push({ step_key: finalValKey, name: "Validation de l'action", step_type: 'validation', order_index: orderIdx++, state_label: 'En attente de validation finale', is_required: true, validation_mode: 'simple' });
    transitions.push({ from_step_key: lastKey, to_step_key: finalValKey, event: 'done' });

    validationConfigs.push({
      name: 'Validation finale', validation_key: 'std_val_final', object_type: 'task',
      source_step_key: finalValKey, validator_type: 'requester',
      on_approved_effect: 'advance_step', on_rejected_effect: 'goto_step',
      on_rejected_target_step_key: execKey, is_active: true, order_index: 1, validation_mode: 'simple',
    });

    lastKey = finalValKey;
  }

  // 7. Closed
  steps.push({ step_key: 'std_closed', name: 'Clôturée', step_type: 'end', order_index: 998, state_label: 'Clôturée', is_required: true });
  transitions.push({ from_step_key: lastKey, to_step_key: 'std_closed', event: options.final_validation ? 'approved' : 'done' });

  // 8. Cancelled
  steps.push({ step_key: 'std_cancelled', name: 'Annulée', step_type: 'end', order_index: 999, state_label: 'Annulée', is_required: false });

  // Notifications
  if (options.enable_notifications) {
    notifications.push({
      step_key: submittedKey, event: 'started',
      subject_template: 'Demande soumise', body_template: 'Votre demande a été soumise avec succès.',
      channels_json: ['in_app'], recipients_rules_json: [{ type: 'requester' }], is_active: true,
    });
    if (options.request_validation) {
      notifications.push({
        step_key: 'std_validation_request', event: 'info',
        subject_template: 'Validation requise', body_template: 'Une demande nécessite votre validation.',
        channels_json: ['in_app'], recipients_rules_json: [{ type: 'manager' }], is_active: true,
      });
    }
  }

  return { steps, transitions, notifications, taskConfigs, validationConfigs };
}

export const ASSIGNMENT_MODE_LABELS: Record<string, string> = {
  auto: 'Automatique',
  manual: 'Manuelle',
  role: 'Par rôle',
  manager: 'Par manager',
};

export const EXECUTOR_TYPE_STANDARD_LABELS: Record<string, string> = {
  specific_user: 'Utilisateur spécifique',
  requester: 'Demandeur',
  requester_manager: 'Manager du demandeur',
  role: 'Rôle',
  manual: 'Affectation manuelle',
  field_value: "Utilisateur d'un champ",
};

export const COMPLETION_BEHAVIOR_OPTIONS: Record<string, string> = {
  close_task: 'Clôture directe',
  send_to_validation: 'Envoi vers validation',
};
