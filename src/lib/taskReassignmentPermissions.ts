import type { Task, TaskStatus } from '@/types/task';

function isTerminalTaskStatus(status: TaskStatus): boolean {
  return (
    status === 'done' ||
    status === 'validated' ||
    status === 'cancelled' ||
    status === 'refused'
  );
}

/**
 * Qui peut ouvrir le flow « Réaffecter » :
 *  - les administrateurs globaux
 *  - le manager (N+1) de l'assigné actuel
 *
 * Restriction métier : un collaborateur ne peut PAS se réaffecter sa propre
 * tâche (il devait au préalable demander à son manager). C'est ce dernier qui
 * pilote la répartition de la charge.
 *
 * Cf. demande utilisateur : « la réaffectation de la tâche doit être limitée
 * au manager pour les collaborateurs ». Avant cette correction, l'assigné
 * lui-même pouvait s'auto-réaffecter — c'était un trou côté gouvernance.
 */
export function canInitiateTaskReassignment(params: {
  task: Pick<Task, 'assignee_id' | 'status' | 'type'>;
  profileId: string | null | undefined;
  assigneeManagerId: string | null | undefined;
  isAdmin: boolean;
}): boolean {
  const { task, profileId, assigneeManagerId, isAdmin } = params;
  if (!profileId) return false;
  if (task.type === 'request') return false;
  if (isTerminalTaskStatus(task.status)) return false;
  if (!task.assignee_id) return false;

  if (isAdmin) return true;
  // Auto-réaffectation par l'assigné NON autorisée — il doit passer par son manager.
  if (assigneeManagerId && assigneeManagerId === profileId) return true;

  return false;
}
