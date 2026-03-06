// Types for wf_task_configs and wf_validation_configs tables

export interface WfTaskConfig {
  id: string;
  workflow_id: string;
  step_key: string;
  task_key: string;
  name: string;
  description: string | null;
  order_index: number;
  is_active: boolean;
  is_required: boolean;
  executor_type: string;
  executor_value: string | null;
  assignment_mode: string;
  trigger_mode: string;
  trigger_task_key: string | null;
  trigger_condition_json: Record<string, unknown> | null;
  initial_status: string;
  completion_behavior: string;
  completion_target_step_key: string | null;
  completion_target_task_key: string | null;
  completion_action_id: string | null;
  validation_config_id: string | null;
  outcome_behaviors_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export type WfTaskConfigInsert = Omit<WfTaskConfig, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type WfTaskConfigUpdate = Partial<Omit<WfTaskConfig, 'id' | 'created_at' | 'updated_at' | 'workflow_id'>>;

export interface WfValidationConfig {
  id: string;
  workflow_id: string;
  validation_key: string;
  name: string;
  description: string | null;
  is_active: boolean;
  order_index: number;
  object_type: string;
  source_step_key: string | null;
  source_task_key: string | null;
  validator_type: string;
  validator_value: string | null;
  validation_mode: string;
  n_required: number | null;
  condition_json: Record<string, unknown> | null;
  on_approved_effect: string;
  on_approved_target_step_key: string | null;
  on_rejected_effect: string;
  on_rejected_target_step_key: string | null;
  target_step_key: string | null;
  created_at: string;
  updated_at: string;
}

export type WfValidationConfigInsert = Omit<WfValidationConfig, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type WfValidationConfigUpdate = Partial<Omit<WfValidationConfig, 'id' | 'created_at' | 'updated_at' | 'workflow_id'>>;

// Labels
export const EXECUTOR_TYPE_LABELS: Record<string, string> = {
  specific_user: 'Utilisateur spécifique',
  requester: 'Demandeur',
  requester_manager: 'Manager du demandeur',
  role: 'Rôle',
  manual: 'Affectation manuelle',
  field_value: 'Champ du formulaire',
};

export const ASSIGNMENT_MODE_LABELS: Record<string, string> = {
  direct: 'Direct',
  round_robin: 'Rotation',
  least_loaded: 'Moins chargé',
};

export const TRIGGER_MODE_LABELS: Record<string, string> = {
  on_step_entry: "À l'entrée de l'étape",
  after_task: 'Après une tâche',
  after_validation: 'Après validation',
  on_condition: 'Sur condition',
  on_step_exit: "À la sortie de l'étape",
};

export const COMPLETION_BEHAVIOR_LABELS: Record<string, string> = {
  close_task: 'Fermer la tâche',
  close_and_advance_step: "Fermer et avancer l'étape",
  close_and_goto_step: 'Fermer et aller à une étape',
  send_to_validation: 'Envoyer en validation',
  create_task: 'Créer une autre tâche',
  trigger_action: 'Déclencher une action',
  wait_validation: 'Attendre une validation',
  stay_on_step: "Rester sur l'étape",
};

export const INITIAL_STATUS_LABELS: Record<string, string> = {
  todo: 'À faire',
  to_assign: 'À affecter',
  'in-progress': 'En cours',
};

export const OBJECT_TYPE_LABELS: Record<string, string> = {
  request: 'Demande',
  task: 'Tâche',
  step: 'Étape',
  deliverable: 'Livrable',
};

export const VALIDATOR_TYPE_LABELS: Record<string, string> = {
  specific_user: 'Utilisateur spécifique',
  requester: 'Demandeur',
  requester_manager: 'Manager du demandeur',
  role: 'Rôle',
  group: 'Groupe',
  department: 'Service',
};

export const VALIDATION_MODE_CONFIG_LABELS: Record<string, string> = {
  simple: 'Simple',
  n_of_m: 'N sur M',
  sequence: 'Séquence',
  unanimous: 'Unanimité',
};

export const ON_APPROVED_LABELS: Record<string, string> = {
  advance_step: "Avancer l'étape",
  goto_step: 'Aller à une étape',
  close_task: 'Fermer la tâche',
  create_task: 'Créer une tâche',
  trigger_action: 'Déclencher une action',
};

export const ON_REJECTED_LABELS: Record<string, string> = {
  return_to_task: 'Retour à la tâche',
  goto_step: 'Aller à une étape',
  cancel_task: 'Annuler la tâche',
  reassign: 'Réaffecter',
};
