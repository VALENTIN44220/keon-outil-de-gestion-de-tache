export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'pending_validation_1' | 'pending_validation_2' | 'validated' | 'refused' | 'to_assign' | 'review' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskType = 'task' | 'request';
export type ValidationStatus = 'pending' | 'approved' | 'rejected';
export type ValidationLevelType = 'none' | 'manager' | 'requester' | 'free';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  category: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  due_date: string | null;
  assignee_id: string | null;
  requester_id: string | null;
  reporter_id: string | null;
  target_department_id: string | null;
  // Numbering fields
  request_number: string | null;
  task_number: string | null;
  // Validation fields (legacy)
  validator_id: string | null;
  validation_requested_at: string | null;
  validated_at: string | null;
  validation_comment: string | null;
  requires_validation: boolean;
  current_validation_level: number;
  // New validation workflow fields
  validation_level_1: ValidationLevelType;
  validation_level_2: ValidationLevelType;
  validator_level_1_id: string | null;
  validator_level_2_id: string | null;
  validation_1_status: 'pending' | 'validated' | 'refused';
  validation_1_at: string | null;
  validation_1_by: string | null;
  validation_1_comment: string | null;
  validation_2_status: 'pending' | 'validated' | 'refused';
  validation_2_at: string | null;
  validation_2_by: string | null;
  validation_2_comment: string | null;
  original_assignee_id: string | null;
  is_locked_for_validation: boolean;
  // Request workflow fields
  parent_request_id: string | null;
  is_assignment_task: boolean;
  source_process_template_id: string | null;
  source_sub_process_template_id: string | null;
  // BE Project fields
  be_project_id: string | null;
  be_label_id: string | null;
  // Double validation (RBE + Requester)
  rbe_validator_id: string | null;
  rbe_validated_at: string | null;
  rbe_validation_status: ValidationStatus | null;
  rbe_validation_comment: string | null;
  requester_validated_at: string | null;
  requester_validation_status: ValidationStatus | null;
  requester_validation_comment: string | null;
  // Request validation (before task creation)
  request_validation_enabled?: boolean;
  request_validation_status?: string;
  request_validator_type_1?: string | null;
  request_validator_id_1?: string | null;
  request_validated_by_1?: string | null;
  request_validation_1_at?: string | null;
  request_validation_1_comment?: string | null;
  request_validator_type_2?: string | null;
  request_validator_id_2?: string | null;
  request_validated_by_2?: string | null;
  request_validation_2_at?: string | null;
  request_validation_2_comment?: string | null;
  request_validation_refusal_action?: string | null;
  // Metadata
  created_at: string;
  updated_at: string;
}

export interface TaskStats {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  pendingValidation: number;
  validated: number;
  refused: number;
  completionRate: number;
}

export interface AssignmentRule {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  target_department_id: string | null;
  target_assignee_id: string | null;
  priority: number;
  is_active: boolean;
  requires_validation: boolean;
  auto_assign: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  name: string;
  url: string;
  type: 'link' | 'file';
  uploaded_by: string | null;
  created_at: string;
}

export interface TaskValidationLevel {
  id: string;
  task_id: string;
  level: number;
  validator_id: string | null;
  validator_department_id: string | null;
  status: 'pending' | 'validated' | 'refused';
  validated_at: string | null;
  comment: string | null;
  created_at: string;
}

export interface TemplateValidationLevel {
  id: string;
  task_template_id: string;
  level: number;
  validator_profile_id: string | null;
  validator_department_id: string | null;
  created_at: string;
}
