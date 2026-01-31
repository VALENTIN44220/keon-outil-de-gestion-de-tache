/**
 * Types et interfaces pour le système de workflow unifié
 */

import type { TaskStatus } from '@/types/task';

// Statuts du sous-processus en exécution
export type SubProcessRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

// Interface pour un sous-processus en exécution
export interface RequestSubProcess {
  id: string;
  request_id: string;
  sub_process_template_id: string;
  status: SubProcessRunStatus;
  started_at: string | null;
  completed_at: string | null;
  workflow_run_id: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

// Interface étendue avec infos du template
export interface RequestSubProcessWithDetails extends RequestSubProcess {
  sub_process_template: {
    id: string;
    name: string;
    description: string | null;
    assignment_type: string;
    target_manager_id: string | null;
    target_department_id: string | null;
  };
  tasks_count: number;
  completed_tasks_count: number;
  progress_percent: number;
}

// Événements workflow
export interface WorkflowEvent {
  id: string;
  event_type: WorkflowEventType;
  entity_type: 'task' | 'request' | 'workflow_run' | 'validation';
  entity_id: string;
  run_id: string | null;
  triggered_by: string | null;
  payload: Record<string, unknown>;
  processed: boolean;
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export type WorkflowEventType =
  | 'request_created'
  | 'request_updated'
  | 'task_created'
  | 'task_assigned'
  | 'task_to_assign'
  | 'task_status_changed'
  | 'task_completed'
  | 'validation_requested'
  | 'validation_decided'
  | 'sub_process_started'
  | 'sub_process_completed'
  | 'process_completed'
  | 'checklist_item_completed'
  | 'comment_added'
  | 'reminder_triggered';

// Transition de statut
export interface TaskStatusTransition {
  id: string;
  task_id: string;
  from_status: string;
  to_status: string;
  changed_by: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Préférences de notification
export interface NotificationPreference {
  id: string;
  user_id: string;
  event_type: string;
  channel: 'in_app' | 'email' | 'teams';
  enabled: boolean;
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  created_at: string;
  updated_at: string;
}

// Log d'exécution workflow
export interface WorkflowExecutionLog {
  id: string;
  run_id: string;
  node_id: string | null;
  action: string;
  actor_id: string | null;
  details: Record<string, unknown>;
  duration_ms: number | null;
  created_at: string;
}

// Vue de progression d'une demande
export interface RequestProgressView {
  request_id: string;
  request_title: string;
  request_status: TaskStatus;
  request_created_at: string;
  sub_processes: Array<{
    run_id: string;
    template_id: string;
    name: string;
    status: SubProcessRunStatus;
    order: number;
    task_count: number;
    completed_count: number;
    progress: number;
  }>;
  overall_progress: number;
}

// Configuration standard S1-S4
export interface StandardWorkflowConfig {
  // S1: Création des tâches
  initial_status: 'todo' | 'to_assign';
  
  // S2: Notifications création
  notify_requester_on_create: boolean;
  notify_assignee_on_create: boolean;
  
  // S3: Notifications changement d'état
  notify_requester_on_status_change: boolean;
  
  // S4: Notification clôture
  notify_requester_on_complete: boolean;
  
  // Validation
  validation_levels: 0 | 1 | 2;
  validation_1_approver?: 'requester' | 'manager' | 'specific_user';
  validation_2_approver?: 'requester' | 'manager' | 'specific_user';
}

// Matrice de transition de statuts
export const STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  'to_assign': ['todo', 'in-progress', 'cancelled'],
  'todo': ['in-progress', 'to_assign', 'cancelled'],
  'in-progress': ['done', 'todo', 'pending_validation_1', 'review', 'cancelled'],
  'pending_validation_1': ['pending_validation_2', 'validated', 'refused', 'review', 'cancelled'],
  'pending_validation_2': ['validated', 'refused', 'review', 'cancelled'],
  'validated': ['done', 'cancelled'],
  'refused': ['todo', 'review', 'cancelled'],
  'review': ['todo', 'in-progress', 'cancelled'],
  'done': [],
  'cancelled': [],
};

// Labels FR des statuts
export const STATUS_LABELS: Record<TaskStatus, string> = {
  'to_assign': 'À affecter',
  'todo': 'À faire',
  'in-progress': 'En cours',
  'done': 'Terminé',
  'pending_validation_1': 'Validation N1',
  'pending_validation_2': 'Validation N2',
  'validated': 'Validé',
  'refused': 'Refusé',
  'review': 'À corriger',
  'cancelled': 'Annulé',
};

// Couleurs des statuts
export const STATUS_COLORS: Record<TaskStatus, string> = {
  'to_assign': 'bg-orange-100 text-orange-800 border-orange-200',
  'todo': 'bg-slate-100 text-slate-800 border-slate-200',
  'in-progress': 'bg-blue-100 text-blue-800 border-blue-200',
  'done': 'bg-green-100 text-green-800 border-green-200',
  'pending_validation_1': 'bg-amber-100 text-amber-800 border-amber-200',
  'pending_validation_2': 'bg-amber-100 text-amber-800 border-amber-200',
  'validated': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'refused': 'bg-red-100 text-red-800 border-red-200',
  'review': 'bg-purple-100 text-purple-800 border-purple-200',
  'cancelled': 'bg-gray-100 text-gray-800 border-gray-200',
};
