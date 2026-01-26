// Workflow Builder Types

export type WorkflowNodeType = 
  | 'start' 
  | 'end' 
  | 'task' 
  | 'validation' 
  | 'notification' 
  | 'condition' 
  | 'sub_process'
  | 'fork'   // Parallel split - starts multiple branches
  | 'join'   // Synchronization - waits for branches
  | 'status_change'   // Change task status based on workflow events
  | 'assignment';     // Task assignment to specific user/group/department

// All possible task statuses
export type TaskStatusType = 'to_assign' | 'todo' | 'in-progress' | 'done' | 'pending-validation' | 'validated' | 'refused' | 'review';

// Task output types for workflow branching
export type TaskOutputType = 'completed' | 'in_progress' | 'validation_request' | 'assigned';

export type WorkflowStatus = 'draft' | 'active' | 'inactive' | 'archived';
export type WorkflowRunStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
export type ValidationInstanceStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'skipped';
export type NotificationChannel = 'in_app' | 'email' | 'teams';
export type ValidationTriggerMode = 'auto' | 'manual';

// Approver types for validation nodes
export type ApproverType = 
  | 'user' 
  | 'role' 
  | 'group' 
  | 'requester_manager' 
  | 'target_manager' 
  | 'department';

// Branch status for parallel execution
export type BranchStatus = 'running' | 'completed' | 'failed' | 'waiting' | 'paused';

// Node configurations
export interface StartNodeConfig {
  trigger?: 'manual' | 'on_create' | 'on_status_change';
}

export interface EndNodeConfig {
  final_status?: 'completed' | 'cancelled';
}

export interface TaskNodeConfig {
  task_template_id?: string;
  task_template_ids?: string[]; // Support multiple task templates
  task_title?: string;
  duration_days?: number;
  responsible_type?: 'requester' | 'assignee' | 'user' | 'group' | 'department';
  responsible_id?: string;
  tags?: string[];
  // Task output configuration
  requires_validation?: boolean;  // If true, user can only select "validation_request"
  enabled_outputs?: TaskOutputType[];  // Which outputs are enabled for this task
}

// Status change node - changes the status of a linked task
export interface StatusChangeNodeConfig {
  target_task_node_id?: string;  // Reference to a task node in the workflow
  new_status: TaskStatusType;
  trigger_event?: 'validation_approved' | 'validation_rejected' | 'task_completed' | 'manual';
}

// Assignment node - assigns task to specific user/group/department
export interface AssignmentNodeConfig {
  assignment_type: 'user' | 'group' | 'department' | 'manager' | 'requester';
  assignee_id?: string;        // For user assignment
  group_id?: string;           // For group assignment  
  department_id?: string;      // For department assignment
  auto_start?: boolean;        // Auto-start task after assignment (change status to todo)
}

export interface SubProcessNodeConfig {
  sub_process_template_id?: string;
  sub_process_name?: string;
  execute_all_tasks?: boolean;
  branch_on_selection?: boolean; // If true, creates branches based on request sub-process selection
}

// Fork node - starts parallel branches
export interface ForkNodeConfig {
  branch_mode: 'static' | 'dynamic';  // static = fixed branches, dynamic = based on sub-processes
  branches?: Array<{
    id: string;
    name: string;
    condition?: string;  // Optional condition for this branch
  }>;
  // For dynamic mode - create branches from selected sub-processes
  from_sub_processes?: boolean;
}

// Join node - synchronizes parallel branches  
export interface JoinNodeConfig {
  join_type: 'and' | 'or' | 'n_of_m';  // and = all branches, or = any branch, n_of_m = specific count
  required_count?: number;  // For n_of_m mode
  timeout_hours?: number;   // Optional timeout for waiting
  on_timeout_action?: 'continue' | 'fail' | 'notify';
  required_branch_ids?: string[];  // Specific branches required (for and/n_of_m)
}

// Validation prerequisites
export interface ValidationPrerequisite {
  type: 'task_completed' | 'validation_approved' | 'condition_true' | 'all_prerequisites';
  task_node_id?: string;      // For task_completed
  validation_node_id?: string; // For validation_approved
  condition_expression?: string; // For condition_true
}

export interface ValidationNodeConfig {
  approver_type: ApproverType;
  approver_id?: string;
  approver_role?: string;
  is_mandatory: boolean;
  approval_mode: 'single' | 'all' | 'quorum';
  quorum_count?: number;
  sla_hours?: number;
  reminder_hours?: number;
  allow_delegation?: boolean;
  on_timeout_action?: 'auto_approve' | 'auto_reject' | 'escalate' | 'notify';
  // NEW: Trigger mode configuration
  trigger_mode: ValidationTriggerMode;  // 'auto' or 'manual'
  // For manual mode - who can trigger
  trigger_allowed_by?: 'task_owner' | 'requester' | 'specific_user';
  trigger_user_id?: string;  // For specific_user mode
  // Prerequisites (for auto mode with conditions)
  prerequisites?: ValidationPrerequisite[];
  // For chained validations (e.g., N1 -> N2)
  auto_trigger_next?: boolean;  // Auto-trigger next validation on approval
  next_validation_node_id?: string;  // Which validation to trigger next
}

export interface NotificationNodeConfig {
  channels: NotificationChannel[];
  recipient_type: 'requester' | 'assignee' | 'approvers' | 'user' | 'group' | 'department' | 'email';
  recipient_id?: string;
  recipient_email?: string;
  subject_template: string;
  body_template: string;
  action_url_template?: string;
}

export interface ConditionNodeConfig {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty';
  value?: string | number | boolean;
  branches: {
    true_label: string;
    false_label: string;
  };
}

export type WorkflowNodeConfig = 
  | StartNodeConfig 
  | EndNodeConfig 
  | TaskNodeConfig 
  | ValidationNodeConfig 
  | NotificationNodeConfig 
  | ConditionNodeConfig
  | SubProcessNodeConfig
  | ForkNodeConfig
  | JoinNodeConfig
  | StatusChangeNodeConfig
  | AssignmentNodeConfig;

// Database entities
export interface WorkflowTemplate {
  id: string;
  process_template_id: string | null;
  sub_process_template_id: string | null;
  name: string;
  description: string | null;
  version: number;
  status: WorkflowStatus;
  is_default: boolean;
  canvas_settings: {
    zoom: number;
    x: number;
    y: number;
  };
  created_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface WorkflowNode {
  id: string;
  workflow_id: string;
  node_type: WorkflowNodeType;
  label: string;
  position_x: number;
  position_y: number;
  config: WorkflowNodeConfig;
  task_template_id: string | null;
  width: number | null;
  height: number | null;
  style: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WorkflowEdge {
  id: string;
  workflow_id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle: string | null;
  target_handle: string | null;
  branch_label: string | null;
  condition_expression: Record<string, unknown> | null;
  label: string | null;
  style: Record<string, unknown>;
  animated: boolean;
  created_at: string;
}

// Branch instance for parallel execution
export interface WorkflowBranchInstance {
  id: string;
  run_id: string;
  branch_id: string;
  fork_node_id: string | null;
  current_node_id: string | null;
  status: BranchStatus;
  context_data: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  workflow_version: number;
  trigger_entity_type: 'task' | 'request';
  trigger_entity_id: string;
  status: WorkflowRunStatus;
  current_node_id: string | null;
  context_data: Record<string, unknown>;
  execution_log: Array<{
    timestamp: string;
    node_id: string;
    action: string;
    details?: Record<string, unknown>;
  }>;
  // Parallel execution tracking
  active_branches: string[];
  completed_branches: string[];
  branch_statuses: Record<string, BranchStatus>;
  started_at: string;
  completed_at: string | null;
  started_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowValidationInstance {
  id: string;
  run_id: string;
  node_id: string;
  approver_type: ApproverType;
  approver_id: string | null;
  approver_role: string | null;
  status: ValidationInstanceStatus;
  decision_comment: string | null;
  decided_by: string | null;
  decided_at: string | null;
  due_at: string | null;
  reminded_at: string | null;
  reminder_count: number;
  // Parallel execution
  branch_id: string | null;
  // Trigger mode
  trigger_mode: ValidationTriggerMode;
  triggered_at: string | null;
  triggered_by: string | null;
  prerequisites_met: boolean;
  prerequisite_config: ValidationPrerequisite[] | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowNotification {
  id: string;
  run_id: string;
  node_id: string;
  channel: NotificationChannel;
  recipient_type: string;
  recipient_id: string | null;
  recipient_email: string | null;
  subject: string;
  body: string;
  action_url: string | null;
  status: 'pending' | 'sent' | 'failed';
  sent_at: string | null;
  error_message: string | null;
  retry_count: number;
  branch_id: string | null;
  created_at: string;
}

// React Flow compatible types
export interface WorkflowFlowNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    config: WorkflowNodeConfig;
    task_template_id?: string | null;
  };
  style?: Record<string, unknown>;
  width?: number;
  height?: number;
}

export interface WorkflowFlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  animated?: boolean;
  style?: Record<string, unknown>;
  data?: {
    branch_label?: string;
    condition_expression?: Record<string, unknown>;
  };
}

// Full workflow with nodes and edges
export interface WorkflowWithDetails extends WorkflowTemplate {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

// Pending validation awaiting manual trigger
export interface PendingManualValidation {
  id: string;
  run_id: string;
  node_id: string;
  task_id: string;
  validation_config: ValidationNodeConfig;
  can_trigger: boolean;
  reason?: string;
}
