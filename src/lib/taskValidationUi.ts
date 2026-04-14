import type { Task, TaskStatus } from '@/types/task';

/** Niveau tel que renvoyé par la BDD (null, chaîne vide, etc. → none). */
export function normalizeValidationLevel(
  v: Task['validation_level_1'] | Task['validation_level_2'] | null | undefined,
): NonNullable<Task['validation_level_1']> {
  if (v === null || v === undefined) return 'none';
  const s = String(v).trim();
  if (s === '' || s === 'none') return 'none';
  if (s === 'manager' || s === 'requester' || s === 'free') return s;
  return 'none';
}

/** La tâche est configurée pour une validation (N1 et/ou N2) avant clôture — réglé sur la tâche modèle, sans magie côté réaffectation. */
export function taskRequiresValidationBeforeDone(
  task: Pick<Task, 'validation_level_1' | 'validation_level_2'>,
): boolean {
  return (
    normalizeValidationLevel(task.validation_level_1) !== 'none' ||
    normalizeValidationLevel(task.validation_level_2) !== 'none'
  );
}

/**
 * Afficher « Envoyer pour validation » à la place de « Marquer terminé » :
 * validation configurée sur le template, tâche encore côté exécutant, pas bloquée en validation.
 */
export function canOfferSendForValidationInsteadOfMarkDone(
  task: Pick<Task, 'validation_level_1' | 'validation_level_2' | 'status' | 'is_locked_for_validation'>,
): boolean {
  if (!taskRequiresValidationBeforeDone(task)) return false;
  if (task.is_locked_for_validation) return false;
  const s = task.status as TaskStatus;
  return s === 'todo' || s === 'in-progress' || s === 'review';
}
