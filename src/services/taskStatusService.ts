/**
 * Service centralisé pour la gestion des transitions de statut des tâches
 * Source unique de vérité pour les règles de transition
 */

import { supabase } from '@/integrations/supabase/client';
import type { TaskStatus } from '@/types/task';

// Mapping des statuts avec libellés FR
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  'to_assign': 'À affecter',
  'todo': 'À faire',
  'in-progress': 'En cours',
  'done': 'Terminé',
  'pending_validation_1': 'En attente validation N1',
  'pending_validation_2': 'En attente validation N2',
  'validated': 'Validé',
  'refused': 'Refusé',
  'review': 'À corriger',
};

// Couleurs des badges de statut
export const TASK_STATUS_COLORS: Record<TaskStatus, { bg: string; text: string; border: string }> = {
  'to_assign': { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  'todo': { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-200' },
  'in-progress': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  'done': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  'pending_validation_1': { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  'pending_validation_2': { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  'validated': { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
  'refused': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  'review': { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
};

// Matrice des transitions valides
const VALID_TRANSITIONS: Partial<Record<TaskStatus, TaskStatus[]>> = {
  'to_assign': ['todo', 'in-progress'],
  'todo': ['in-progress', 'to_assign'],
  'in-progress': ['done', 'todo', 'pending_validation_1', 'review'],
  'pending_validation_1': ['pending_validation_2', 'validated', 'refused', 'review'],
  'pending_validation_2': ['validated', 'refused', 'review'],
  'validated': ['done'],
  'refused': ['todo', 'review'],
  'review': ['todo', 'in-progress'],
  'done': [],
};

// Statuts "terminaux" (workflow complet)
export const TERMINAL_STATUSES: TaskStatus[] = ['done', 'validated'];

// Statuts nécessitant une action
export const ACTION_REQUIRED_STATUSES: TaskStatus[] = ['to_assign', 'pending_validation_1', 'pending_validation_2', 'review'];

/**
 * Vérifie si une transition de statut est valide
 */
export function isValidTransition(fromStatus: TaskStatus, toStatus: TaskStatus): boolean {
  const allowedTargets = VALID_TRANSITIONS[fromStatus];
  return allowedTargets?.includes(toStatus) ?? false;
}

/**
 * Obtient les statuts disponibles depuis un statut donné
 */
export function getAvailableTransitions(fromStatus: TaskStatus): TaskStatus[] {
  return VALID_TRANSITIONS[fromStatus] || [];
}

/**
 * Vérifie si une tâche est terminée
 */
export function isTaskCompleted(status: TaskStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Vérifie si une tâche nécessite une action
 */
export function requiresAction(status: TaskStatus): boolean {
  return ACTION_REQUIRED_STATUSES.includes(status);
}

/**
 * Service principal de transition de statut
 */
export interface TransitionResult {
  success: boolean;
  error?: string;
  previousStatus?: TaskStatus;
  newStatus?: TaskStatus;
}

export interface TransitionOptions {
  reason?: string;
  assigneeId?: string;
  validatorId?: string;
  comment?: string;
}

/**
 * Effectue une transition de statut sur une tâche
 */
export async function transitionTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
  options: TransitionOptions = {}
): Promise<TransitionResult> {
  try {
    // Récupérer l'état actuel de la tâche
    const { data: task, error: fetchError } = await supabase
      .from('tasks')
      .select('id, status, assignee_id, type, parent_request_id, workflow_run_id')
      .eq('id', taskId)
      .single();

    if (fetchError || !task) {
      return { success: false, error: 'Tâche non trouvée' };
    }

    const currentStatus = task.status as TaskStatus;

    // Vérifier si la transition est valide
    if (!isValidTransition(currentStatus, newStatus)) {
      return { 
        success: false, 
        error: `Transition non autorisée: ${TASK_STATUS_LABELS[currentStatus]} → ${TASK_STATUS_LABELS[newStatus]}`
      };
    }

    // Préparer les données de mise à jour
    const updateData: Record<string, unknown> = {
      status: newStatus,
    };

    // Gestion spécifique selon le nouveau statut
    if (newStatus === 'todo' && options.assigneeId) {
      updateData.assignee_id = options.assigneeId;
    }

    if (newStatus === 'pending_validation_1' && options.validatorId) {
      updateData.validator_level_1_id = options.validatorId;
    }

    if (newStatus === 'pending_validation_2' && options.validatorId) {
      updateData.validator_level_2_id = options.validatorId;
    }

    if (newStatus === 'validated') {
      updateData.validated_at = new Date().toISOString();
    }

    if (newStatus === 'refused') {
      updateData.validation_comment = options.comment;
    }

    // Effectuer la mise à jour
    const { error: updateError } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return {
      success: true,
      previousStatus: currentStatus,
      newStatus,
    };
  } catch (error) {
    console.error('Error transitioning task status:', error);
    return { success: false, error: 'Erreur lors de la transition' };
  }
}

/**
 * Effectue une affectation de tâche (to_assign → todo)
 */
export async function assignTask(
  taskId: string,
  assigneeId: string
): Promise<TransitionResult> {
  return transitionTaskStatus(taskId, 'todo', { assigneeId });
}

/**
 * Démarre une tâche (todo → in-progress)
 */
export async function startTask(taskId: string): Promise<TransitionResult> {
  return transitionTaskStatus(taskId, 'in-progress');
}

/**
 * Termine une tâche (in-progress → done)
 */
export async function completeTask(taskId: string): Promise<TransitionResult> {
  return transitionTaskStatus(taskId, 'done');
}

/**
 * Demande une validation (in-progress → pending_validation_1)
 */
export async function requestValidation(
  taskId: string,
  validatorId?: string
): Promise<TransitionResult> {
  return transitionTaskStatus(taskId, 'pending_validation_1', { validatorId });
}

/**
 * Valide une tâche au niveau 1
 */
export async function validateLevel1(
  taskId: string,
  toLevel2: boolean = false
): Promise<TransitionResult> {
  const newStatus: TaskStatus = toLevel2 ? 'pending_validation_2' : 'validated';
  return transitionTaskStatus(taskId, newStatus);
}

/**
 * Valide une tâche au niveau 2
 */
export async function validateLevel2(taskId: string): Promise<TransitionResult> {
  return transitionTaskStatus(taskId, 'validated');
}

/**
 * Refuse une validation
 */
export async function rejectValidation(
  taskId: string,
  comment?: string
): Promise<TransitionResult> {
  return transitionTaskStatus(taskId, 'refused', { comment });
}

/**
 * Met une tâche en révision
 */
export async function requestRevision(
  taskId: string,
  comment?: string
): Promise<TransitionResult> {
  return transitionTaskStatus(taskId, 'review', { comment });
}

/**
 * Calcule le pourcentage de progression d'un ensemble de tâches
 */
export function calculateProgress(tasks: { status: TaskStatus }[]): number {
  if (tasks.length === 0) return 0;
  
  const completedCount = tasks.filter(t => isTaskCompleted(t.status)).length;
  return Math.round((completedCount / tasks.length) * 100);
}

/**
 * Obtient le statut agrégé pour un groupe de tâches
 */
export function getAggregatedStatus(tasks: { status: TaskStatus }[]): 'not_started' | 'in_progress' | 'completed' | 'blocked' {
  if (tasks.length === 0) return 'not_started';
  
  const allCompleted = tasks.every(t => isTaskCompleted(t.status));
  if (allCompleted) return 'completed';
  
  const hasBlocked = tasks.some(t => t.status === 'refused' || t.status === 'review');
  if (hasBlocked) return 'blocked';
  
  const hasInProgress = tasks.some(t => !['to_assign', 'todo'].includes(t.status) && !isTaskCompleted(t.status));
  if (hasInProgress) return 'in_progress';
  
  return 'not_started';
}
