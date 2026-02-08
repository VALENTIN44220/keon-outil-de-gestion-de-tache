/**
 * Service centralisé pour la gestion des transitions de statut des tâches
 * Source unique de vérité pour les règles de transition et les libellés
 */

import { supabase } from '@/integrations/supabase/client';
import type { TaskStatus } from '@/types/task';
import { emitWorkflowEvent } from './workflowEventService';

// ============================================================================
// LABELS ET COULEURS (SOURCE UNIQUE DE VÉRITÉ)
// ============================================================================

// Mapping des statuts avec libellés FR
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  'to_assign': 'À affecter',
  'todo': 'À faire',
  'in-progress': 'En cours',
  'done': 'Terminé',
  'pending_validation_1': 'En attente de validation',
  'pending_validation_2': 'En attente de validation (N2)',
  'validated': 'Validé / Terminé',
  'refused': 'Refusé', // Statut transitoire (audit uniquement)
  'review': 'À corriger',
  'cancelled': 'Annulé',
};

// Libellés simplifiés pour affichage compact
export const TASK_STATUS_SHORT_LABELS: Record<TaskStatus, string> = {
  'to_assign': 'À affecter',
  'todo': 'À faire',
  'in-progress': 'En cours',
  'done': 'Terminé',
  'pending_validation_1': 'Validation',
  'pending_validation_2': 'Validation N2',
  'validated': 'Validé',
  'refused': 'Refusé',
  'review': 'À corriger',
  'cancelled': 'Annulé',
};

// Couleurs des badges de statut
export const TASK_STATUS_COLORS: Record<TaskStatus, { bg: string; text: string; border: string; gradient?: string; calendar?: string }> = {
  'to_assign': { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200', gradient: 'from-amber-500 to-amber-400', calendar: 'bg-amber-500' },
  'todo': { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-200', gradient: 'from-slate-500 to-slate-400', calendar: 'bg-slate-500' },
  'in-progress': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200', gradient: 'from-blue-500 to-blue-400', calendar: 'bg-blue-500' },
  'done': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200', gradient: 'from-green-500 to-green-400', calendar: 'bg-green-500' },
  'pending_validation_1': { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-200', gradient: 'from-violet-500 to-violet-400', calendar: 'bg-violet-500' },
  'pending_validation_2': { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-200', gradient: 'from-violet-500 to-violet-400', calendar: 'bg-violet-500' },
  'validated': { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200', gradient: 'from-emerald-500 to-emerald-400', calendar: 'bg-emerald-500' },
  'refused': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200', gradient: 'from-red-500 to-red-400', calendar: 'bg-red-500' },
  'review': { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200', gradient: 'from-purple-500 to-purple-400', calendar: 'bg-purple-500' },
  'cancelled': { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200', gradient: 'from-gray-400 to-gray-300', calendar: 'bg-gray-400' },
};

/**
 * Obtient la couleur de calendrier pour un statut (format Tailwind class)
 */
export function getStatusCalendarColor(status: TaskStatus | string): string {
  const colors = TASK_STATUS_COLORS[status as TaskStatus];
  return colors?.calendar || 'bg-primary';
}

// ============================================================================
// HELPERS POUR L'UI (UTILISER CES FONCTIONS PARTOUT)
// ============================================================================

/**
 * Obtient le libellé d'un statut
 */
export function getStatusLabel(status: TaskStatus | string): string {
  return TASK_STATUS_LABELS[status as TaskStatus] || status;
}

/**
 * Obtient le libellé court d'un statut
 */
export function getStatusShortLabel(status: TaskStatus | string): string {
  return TASK_STATUS_SHORT_LABELS[status as TaskStatus] || status;
}

/**
 * Obtient la configuration de couleur d'un statut
 */
export function getStatusColor(status: TaskStatus | string) {
  return TASK_STATUS_COLORS[status as TaskStatus] || TASK_STATUS_COLORS.todo;
}

/**
 * Options de filtre avec regroupement "En attente de validation"
 */
export function getStatusFilterOptions(): Array<{ value: string; label: string; statuses: TaskStatus[] }> {
  return [
    { value: 'all', label: 'Tous', statuses: [] },
    { value: 'to_assign', label: 'À affecter', statuses: ['to_assign'] },
    { value: 'todo', label: 'À faire', statuses: ['todo'] },
    { value: 'in-progress', label: 'En cours', statuses: ['in-progress'] },
    { value: 'pending_validation', label: 'En attente de validation', statuses: ['pending_validation_1', 'pending_validation_2'] },
    { value: 'validated', label: 'Validé / Terminé', statuses: ['validated'] },
    { value: 'done', label: 'Terminé', statuses: ['done'] },
    { value: 'review', label: 'À corriger', statuses: ['review'] },
    { value: 'cancelled', label: 'Annulé', statuses: ['cancelled'] },
  ];
}

/**
 * Options de statut pour les selects (sans regroupement)
 */
export function getStatusSelectOptions(): Array<{ value: TaskStatus; label: string }> {
  return [
    { value: 'to_assign', label: 'À affecter' },
    { value: 'todo', label: 'À faire' },
    { value: 'in-progress', label: 'En cours' },
    { value: 'done', label: 'Terminé' },
    { value: 'pending_validation_1', label: 'En attente de validation' },
    { value: 'pending_validation_2', label: 'En attente de validation (N2)' },
    { value: 'validated', label: 'Validé / Terminé' },
    { value: 'review', label: 'À corriger' },
    { value: 'cancelled', label: 'Annulé' },
  ];
}

/**
 * Vérifie si un statut correspond à un filtre (avec support du regroupement)
 */
export function matchesStatusFilter(taskStatus: TaskStatus | string, filterValue: string): boolean {
  if (filterValue === 'all') return true;
  
  const filterOption = getStatusFilterOptions().find(opt => opt.value === filterValue);
  if (!filterOption) return taskStatus === filterValue;
  
  return filterOption.statuses.includes(taskStatus as TaskStatus);
}

/**
 * Vérifie si le statut est "en attente de validation" (N1 ou N2)
 */
export function isPendingValidation(status: TaskStatus | string): boolean {
  return status === 'pending_validation_1' || status === 'pending_validation_2';
}

/**
 * Vérifie si le statut est considéré comme "terminé" (done OU validated)
 */
export function isCompleted(status: TaskStatus | string): boolean {
  return status === 'done' || status === 'validated';
}

// ============================================================================
// RÈGLES DE TRANSITION
// ============================================================================

// Matrice des transitions valides
const VALID_TRANSITIONS: Partial<Record<TaskStatus, TaskStatus[]>> = {
  'to_assign': ['todo', 'in-progress', 'cancelled'],
  'todo': ['in-progress', 'to_assign', 'cancelled'],
  'in-progress': ['done', 'todo', 'pending_validation_1', 'review', 'cancelled'],
  'pending_validation_1': ['pending_validation_2', 'validated', 'in-progress', 'review', 'cancelled'],
  'pending_validation_2': ['validated', 'in-progress', 'review', 'cancelled'],
  'validated': ['cancelled'], // Statut terminal - seul annulation possible
  'refused': ['todo', 'in-progress', 'review', 'cancelled'], // Statut transitoire
  'review': ['todo', 'in-progress', 'cancelled'],
  'done': ['in-progress', 'cancelled'], // Réouverture possible
  'cancelled': [], // Statut terminal - aucune transition
};

// Statuts "terminaux" (workflow complet)
export const TERMINAL_STATUSES: TaskStatus[] = ['done', 'validated', 'cancelled'];

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

// ============================================================================
// SERVICE DE TRANSITION
// ============================================================================

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
  skipEventEmission?: boolean;
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
      .select('id, status, assignee_id, requester_id, type, parent_request_id, workflow_run_id, validator_level_1_id, validator_level_2_id, title')
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
      updated_at: new Date().toISOString(),
    };

    // Gestion spécifique selon le nouveau statut
    if (newStatus === 'todo' && options.assigneeId) {
      updateData.assignee_id = options.assigneeId;
    }

    if (newStatus === 'pending_validation_1') {
      updateData.original_assignee_id = task.assignee_id;
      updateData.is_locked_for_validation = true;
      updateData.validation_1_status = 'pending';
      if (options.validatorId) {
        updateData.validator_level_1_id = options.validatorId;
      }
    }

    if (newStatus === 'pending_validation_2') {
      updateData.validation_2_status = 'pending';
      if (options.validatorId) {
        updateData.validator_level_2_id = options.validatorId;
      }
    }

    if (newStatus === 'validated') {
      updateData.validated_at = new Date().toISOString();
      updateData.is_locked_for_validation = false;
    }

    if (newStatus === 'in-progress' && isPendingValidation(currentStatus)) {
      // Retour en cours après refus - unlock
      updateData.is_locked_for_validation = false;
    }

    // Effectuer la mise à jour
    const { error: updateError } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Émettre l'événement de changement de statut
    if (!options.skipEventEmission) {
      await emitWorkflowEvent(
        'task_status_changed',
        'task',
        taskId,
        {
          from_status: currentStatus,
          to_status: newStatus,
          task_id: taskId,
          task_title: task.title,
          assignee_id: task.assignee_id,
          requester_id: task.requester_id,
          validator_id: newStatus === 'pending_validation_1' 
            ? (options.validatorId || task.validator_level_1_id)
            : newStatus === 'pending_validation_2'
              ? (options.validatorId || task.validator_level_2_id)
              : undefined,
          comment: options.comment,
        },
        task.workflow_run_id || undefined
      );
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

// ============================================================================
// API HAUT NIVEAU POUR LE WORKFLOW DE VALIDATION
// ============================================================================

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
 * @param toLevel2 - Si true, passe au niveau 2 au lieu de valider directement
 */
export async function validateLevel1(
  taskId: string,
  toLevel2: boolean = false,
  validatorId?: string,
  comment?: string
): Promise<TransitionResult> {
  // D'abord mettre à jour les champs d'audit de validation N1
  const { error: auditError } = await supabase
    .from('tasks')
    .update({
      validation_1_status: 'validated',
      validation_1_at: new Date().toISOString(),
      validation_1_by: validatorId,
      validation_1_comment: comment || null,
    })
    .eq('id', taskId);

  if (auditError) {
    console.error('Error updating validation audit:', auditError);
  }

  const newStatus: TaskStatus = toLevel2 ? 'pending_validation_2' : 'validated';
  return transitionTaskStatus(taskId, newStatus, { validatorId, comment });
}

/**
 * Valide une tâche au niveau 2
 */
export async function validateLevel2(
  taskId: string,
  validatorId?: string,
  comment?: string
): Promise<TransitionResult> {
  // D'abord mettre à jour les champs d'audit de validation N2
  const { error: auditError } = await supabase
    .from('tasks')
    .update({
      validation_2_status: 'validated',
      validation_2_at: new Date().toISOString(),
      validation_2_by: validatorId,
      validation_2_comment: comment || null,
    })
    .eq('id', taskId);

  if (auditError) {
    console.error('Error updating validation audit:', auditError);
  }

  return transitionTaskStatus(taskId, 'validated', { validatorId, comment });
}

/**
 * Refuse une validation et remet la tâche en cours
 * ⚠️ IMPORTANT: Le statut principal devient 'in-progress', pas 'refused'
 * Le refus est tracé dans validation_X_status pour l'audit
 */
export async function rejectValidationToInProgress(
  taskId: string,
  level: 1 | 2,
  validatorId: string,
  comment: string
): Promise<TransitionResult> {
  try {
    // Mettre à jour les champs d'audit pour tracer le refus
    const auditUpdates: Record<string, unknown> = {
      [`validation_${level}_status`]: 'refused',
      [`validation_${level}_at`]: new Date().toISOString(),
      [`validation_${level}_by`]: validatorId,
      [`validation_${level}_comment`]: comment,
      is_locked_for_validation: false,
    };

    const { error: auditError } = await supabase
      .from('tasks')
      .update(auditUpdates)
      .eq('id', taskId);

    if (auditError) {
      return { success: false, error: 'Erreur lors de la mise à jour de l\'audit' };
    }

    // Transition vers in-progress (et non refused)
    return transitionTaskStatus(taskId, 'in-progress', { 
      comment,
      skipEventEmission: false, // On veut émettre l'événement pour notifier
    });
  } catch (error) {
    console.error('Error rejecting validation:', error);
    return { success: false, error: 'Erreur lors du refus de validation' };
  }
}

/**
 * Met une tâche en révision
 * @deprecated Utiliser rejectValidationToInProgress pour les refus de validation
 */
export async function requestRevision(
  taskId: string,
  comment?: string
): Promise<TransitionResult> {
  return transitionTaskStatus(taskId, 'review', { comment });
}

// ============================================================================
// UTILITAIRES DE CALCUL
// ============================================================================

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
  
  const hasBlocked = tasks.some(t => t.status === 'review');
  if (hasBlocked) return 'blocked';
  
  const hasInProgress = tasks.some(t => !['to_assign', 'todo'].includes(t.status) && !isTaskCompleted(t.status));
  if (hasInProgress) return 'in_progress';
  
  return 'not_started';
}

/**
 * Compte les tâches en attente de validation (N1 + N2)
 */
export function countPendingValidation(tasks: { status: TaskStatus | string }[]): number {
  return tasks.filter(t => isPendingValidation(t.status)).length;
}

/**
 * Compte les tâches terminées (done + validated)
 */
export function countCompleted(tasks: { status: TaskStatus | string }[]): number {
  return tasks.filter(t => isCompleted(t.status)).length;
}
