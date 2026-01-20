import { useMemo } from 'react';
import { Task } from '@/types/task';
import { useAuth } from '@/contexts/AuthContext';

interface DueDatePermissionResult {
  canEditDueDate: boolean;
  reason: string;
}

/**
 * Hook to determine if the current user can edit the due date of a task.
 * 
 * Rules:
 * - For personal tasks (requester_id === assignee_id) or team assignments:
 *   The requester can set/modify the duration
 * - For all other cases:
 *   The assignee or their manager can set/modify the duration
 */
export function useDueDatePermission(task: Task | null): DueDatePermissionResult {
  const { profile, user } = useAuth();

  return useMemo(() => {
    if (!task || !profile || !user) {
      return { canEditDueDate: false, reason: 'Données non disponibles' };
    }

    const currentProfileId = profile.id;
    const isRequester = task.requester_id === currentProfileId;
    const isAssignee = task.assignee_id === currentProfileId;
    const isCreator = task.user_id === user.id;

    // Check if this is a personal task or team assignment
    // Personal task: requester_id === assignee_id (same person)
    // Team task: has a requester who assigned to someone else in their team
    const isPersonalTask = task.requester_id && task.assignee_id && task.requester_id === task.assignee_id;
    const isTeamAssignment = task.requester_id && !isPersonalTask;

    // For personal tasks: only the owner (requester = assignee) can edit
    if (isPersonalTask) {
      if (isRequester) {
        return { canEditDueDate: true, reason: 'Vous êtes le créateur de cette tâche personnelle' };
      }
      return { canEditDueDate: false, reason: 'Seul le créateur peut modifier la durée de cette tâche personnelle' };
    }

    // For team assignments (requester assigns to team member):
    // Requester can set/modify duration
    if (isTeamAssignment && isRequester) {
      return { canEditDueDate: true, reason: 'Vous êtes le demandeur de cette tâche' };
    }

    // For all other cases: assignee or their manager can modify
    if (isAssignee) {
      return { canEditDueDate: true, reason: 'Vous êtes l\'exécutant de cette tâche' };
    }

    // Check if current user is the manager of the assignee
    // This requires checking the profile's manager_id
    // For now, we'll check if the current user is the manager of the assigned person
    // This will be handled via a separate check with the profiles data

    // If the user is the creator, allow editing (fallback for admin/managers)
    if (isCreator) {
      return { canEditDueDate: true, reason: 'Vous êtes le créateur de cette tâche' };
    }

    // Default: cannot edit
    return { canEditDueDate: false, reason: 'Seuls l\'exécutant ou son manager peuvent modifier la durée' };
  }, [task, profile, user]);
}

/**
 * Extended hook that also checks if the current user is the manager of the assignee
 */
export function useDueDatePermissionWithManager(
  task: Task | null,
  assigneeManagerId: string | null
): DueDatePermissionResult {
  const { profile, user } = useAuth();

  return useMemo(() => {
    if (!task || !profile || !user) {
      return { canEditDueDate: false, reason: 'Données non disponibles' };
    }

    const currentProfileId = profile.id;
    const isRequester = task.requester_id === currentProfileId;
    const isAssignee = task.assignee_id === currentProfileId;
    const isCreator = task.user_id === user.id;
    const isAssigneeManager = assigneeManagerId === currentProfileId;

    // Check if this is a personal task or team assignment
    const isPersonalTask = task.requester_id && task.assignee_id && task.requester_id === task.assignee_id;
    const isTeamAssignment = task.requester_id && !isPersonalTask;

    // For personal tasks: only the owner can edit
    if (isPersonalTask) {
      if (isRequester) {
        return { canEditDueDate: true, reason: 'Vous êtes le créateur de cette tâche personnelle' };
      }
      return { canEditDueDate: false, reason: 'Seul le créateur peut modifier la durée de cette tâche personnelle' };
    }

    // For team assignments: requester can set/modify duration
    if (isTeamAssignment && isRequester) {
      return { canEditDueDate: true, reason: 'Vous êtes le demandeur de cette tâche' };
    }

    // For all other cases: assignee or their manager can modify
    if (isAssignee) {
      return { canEditDueDate: true, reason: 'Vous êtes l\'exécutant de cette tâche' };
    }

    if (isAssigneeManager) {
      return { canEditDueDate: true, reason: 'Vous êtes le manager de l\'exécutant' };
    }

    // If the user is the creator, allow editing (fallback)
    if (isCreator) {
      return { canEditDueDate: true, reason: 'Vous êtes le créateur de cette tâche' };
    }

    // Default: cannot edit
    return { canEditDueDate: false, reason: 'Seuls l\'exécutant ou son manager peuvent modifier la durée' };
  }, [task, profile, user, assigneeManagerId]);
}
