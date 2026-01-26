import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { PendingManualValidation, ValidationNodeConfig, ValidationTriggerMode } from '@/types/workflow';

export function useManualValidation() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Check if a task has a pending manual validation that can be triggered
  const checkPendingManualValidation = useCallback(async (taskId: string): Promise<PendingManualValidation | null> => {
    if (!user) return null;

    try {
      // Get current user's profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) return null;

      // Find workflow runs for this task that have a manual validation pending
      const { data: runs } = await supabase
        .from('workflow_runs')
        .select('*')
        .eq('trigger_entity_id', taskId)
        .in('status', ['running', 'paused']);

      if (!runs || runs.length === 0) return null;

      for (const run of runs) {
        // Get the current node
        if (!run.current_node_id) continue;

        const { data: currentNode } = await supabase
          .from('workflow_nodes')
          .select('*')
          .eq('id', run.current_node_id)
          .maybeSingle();

        if (!currentNode || currentNode.node_type !== 'validation') continue;

        const config = currentNode.config as unknown as ValidationNodeConfig;
        
        // Check if it's a manual trigger validation
        if (config.trigger_mode !== 'manual') continue;

        // Check if there's already a validation instance that hasn't been triggered
        const { data: existingValidation } = await supabase
          .from('workflow_validation_instances')
          .select('*')
          .eq('run_id', run.id)
          .eq('node_id', currentNode.id)
          .maybeSingle();

        // If validation exists and is not triggered yet (no triggered_at)
        if (existingValidation && !existingValidation.triggered_at) {
          // Check if current user can trigger
          const canTrigger = await checkCanTrigger(taskId, config, profile.id);
          
          return {
            id: existingValidation.id,
            run_id: run.id,
            node_id: currentNode.id,
            task_id: taskId,
            validation_config: config,
            can_trigger: canTrigger.allowed,
            reason: canTrigger.reason,
          };
        }

        // If no validation instance exists yet for manual mode, create one in waiting state
        if (!existingValidation) {
          const canTrigger = await checkCanTrigger(taskId, config, profile.id);
          
          return {
            id: '', // Will be created on trigger
            run_id: run.id,
            node_id: currentNode.id,
            task_id: taskId,
            validation_config: config,
            can_trigger: canTrigger.allowed,
            reason: canTrigger.reason,
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error checking pending manual validation:', error);
      return null;
    }
  }, [user]);

  // Check if user can trigger the validation
  const checkCanTrigger = async (
    taskId: string, 
    config: ValidationNodeConfig, 
    currentProfileId: string
  ): Promise<{ allowed: boolean; reason?: string }> => {
    // Get the task
    const { data: task } = await supabase
      .from('tasks')
      .select('assignee_id, user_id, requester_id, status')
      .eq('id', taskId)
      .maybeSingle();

    if (!task) {
      return { allowed: false, reason: 'Tâche introuvable' };
    }

    // Check task status - must be done or in a ready state
    if (!['done', 'in-progress'].includes(task.status)) {
      return { allowed: false, reason: 'La tâche doit être terminée ou en cours pour déclencher la validation' };
    }

    // Check who is allowed to trigger
    switch (config.trigger_allowed_by) {
      case 'task_owner':
        if (task.assignee_id !== currentProfileId && task.user_id !== currentProfileId) {
          return { allowed: false, reason: 'Seul le responsable de la tâche peut déclencher cette validation' };
        }
        break;
      case 'requester':
        if (task.requester_id !== currentProfileId) {
          return { allowed: false, reason: 'Seul le demandeur peut déclencher cette validation' };
        }
        break;
      case 'specific_user':
        if (config.trigger_user_id !== currentProfileId) {
          return { allowed: false, reason: 'Vous n\'êtes pas autorisé à déclencher cette validation' };
        }
        break;
      default:
        // Default: task owner can trigger
        if (task.assignee_id !== currentProfileId && task.user_id !== currentProfileId) {
          return { allowed: false, reason: 'Seul le responsable de la tâche peut déclencher cette validation' };
        }
    }

    // Check prerequisites if any
    if (config.prerequisites && config.prerequisites.length > 0) {
      // For now, we'll skip prerequisite checking - can be enhanced later
    }

    return { allowed: true };
  };

  // Trigger a manual validation
  const triggerManualValidation = useCallback(async (
    pendingValidation: PendingManualValidation
  ): Promise<boolean> => {
    if (!user) return false;

    setIsLoading(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) {
        toast.error('Profil utilisateur non trouvé');
        return false;
      }

      const config = pendingValidation.validation_config;

      // Determine approver
      let approverId: string | null = null;

      switch (config.approver_type) {
        case 'user':
          approverId = config.approver_id || null;
          break;
        case 'requester_manager':
          const { data: task } = await supabase
            .from('tasks')
            .select('requester_id')
            .eq('id', pendingValidation.task_id)
            .maybeSingle();
          
          if (task?.requester_id) {
            const { data: requesterProfile } = await supabase
              .from('profiles')
              .select('manager_id')
              .eq('id', task.requester_id)
              .maybeSingle();
            approverId = requesterProfile?.manager_id || null;
          }
          break;
        case 'target_manager':
          const { data: taskForManager } = await supabase
            .from('tasks')
            .select('assignee_id')
            .eq('id', pendingValidation.task_id)
            .maybeSingle();
          
          if (taskForManager?.assignee_id) {
            const { data: assigneeProfile } = await supabase
              .from('profiles')
              .select('manager_id')
              .eq('id', taskForManager.assignee_id)
              .maybeSingle();
            approverId = assigneeProfile?.manager_id || null;
          }
          break;
      }

      // Calculate due date
      const dueAt = config.sla_hours 
        ? new Date(Date.now() + config.sla_hours * 60 * 60 * 1000).toISOString()
        : null;

      if (pendingValidation.id) {
        // Update existing validation instance
        await supabase
          .from('workflow_validation_instances')
          .update({
            triggered_at: new Date().toISOString(),
            triggered_by: profile.id,
            prerequisites_met: true,
            approver_id: approverId,
            due_at: dueAt,
          })
          .eq('id', pendingValidation.id);
      } else {
        // Create new validation instance
        await supabase
          .from('workflow_validation_instances')
          .insert({
            run_id: pendingValidation.run_id,
            node_id: pendingValidation.node_id,
            approver_type: config.approver_type,
            approver_id: approverId,
            approver_role: config.approver_role || null,
            status: 'pending',
            trigger_mode: 'manual',
            triggered_at: new Date().toISOString(),
            triggered_by: profile.id,
            prerequisites_met: true,
            due_at: dueAt,
          });
      }

      // Update task status to pending-validation
      await supabase
        .from('tasks')
        .update({ status: 'pending-validation' })
        .eq('id', pendingValidation.task_id);

      // Update workflow run status
      await supabase
        .from('workflow_runs')
        .update({ status: 'paused' })
        .eq('id', pendingValidation.run_id);

      toast.success('Demande de validation envoyée');
      return true;
    } catch (error) {
      console.error('Error triggering manual validation:', error);
      toast.error('Erreur lors de la demande de validation');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return {
    isLoading,
    checkPendingManualValidation,
    triggerManualValidation,
  };
}
