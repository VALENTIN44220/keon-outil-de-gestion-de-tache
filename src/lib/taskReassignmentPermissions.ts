import type { Task, TaskStatus } from '@/types/task';

function isTerminalTaskStatus(status: TaskStatus): boolean {
  return (
    status === 'done' ||
    status === 'validated' ||
    status === 'cancelled' ||
    status === 'refused'
  );
}

/** Who may open the « Réaffecter » flow: current assignee, their manager, or admin. */
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
  if (task.assignee_id === profileId) return true;
  if (assigneeManagerId && assigneeManagerId === profileId) return true;

  return false;
}
