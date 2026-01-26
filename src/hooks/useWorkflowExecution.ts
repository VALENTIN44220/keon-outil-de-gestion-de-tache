import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';
import type { 
  WorkflowRun, 
  WorkflowRunStatus,
  WorkflowNode,
  WorkflowEdge,
  WorkflowValidationInstance,
  ValidationInstanceStatus,
  WorkflowNodeType,
  WorkflowNodeConfig,
  ValidationNodeConfig,
  NotificationNodeConfig,
  ApproverType,
  ValidationTriggerMode,
  ValidationPrerequisite,
} from '@/types/workflow';

interface ExecutionContext {
  entityType: 'task' | 'request';
  entityId: string;
  requester_id?: string;
  assignee_id?: string;
  department_id?: string;
  manager_id?: string;
  custom_fields?: Record<string, unknown>;
}

export function useWorkflowExecution() {
  const { user } = useAuth();
  const [isExecuting, setIsExecuting] = useState(false);

  // Start a new workflow run
  const startWorkflow = useCallback(async (
    workflowId: string,
    context: ExecutionContext
  ): Promise<string | null> => {
    if (!user) return null;

    setIsExecuting(true);
    try {
      // Get the workflow template with nodes and edges
      const [{ data: workflow }, { data: nodes }, { data: edges }] = await Promise.all([
        supabase.from('workflow_templates').select('*').eq('id', workflowId).single(),
        supabase.from('workflow_nodes').select('*').eq('workflow_id', workflowId),
        supabase.from('workflow_edges').select('*').eq('workflow_id', workflowId),
      ]);

      if (!workflow || !nodes) {
        toast.error('Workflow non trouvé');
        return null;
      }

      // Find the start node
      const startNode = nodes.find(n => n.node_type === 'start');
      if (!startNode) {
        toast.error('Le workflow n\'a pas de nœud de départ');
        return null;
      }

      // Create the workflow run
      const runData = {
        workflow_id: workflowId,
        workflow_version: workflow.version,
        trigger_entity_type: context.entityType,
        trigger_entity_id: context.entityId,
        status: 'running' as const,
        current_node_id: startNode.id,
        context_data: context as unknown as Json,
        execution_log: [{
          timestamp: new Date().toISOString(),
          node_id: startNode.id,
          action: 'workflow_started',
          details: { triggered_by: user.id }
        }] as unknown as Json,
        started_by: user.id,
      };

      const { data: run, error } = await supabase
        .from('workflow_runs')
        .insert([runData])
        .select()
        .single();

      if (error) throw error;

      // Process the start node and move to the next
      await processNode(run.id, startNode, nodes, edges || [], context);

      toast.success('Workflow démarré');
      return run.id;
    } catch (error) {
      console.error('Error starting workflow:', error);
      toast.error('Erreur lors du démarrage du workflow');
      return null;
    } finally {
      setIsExecuting(false);
    }
  }, [user]);

  // Process a single node
  const processNode = async (
    runId: string,
    node: { id: string; node_type: string; config: unknown; task_template_id?: string | null },
    allNodes: Array<{ id: string; node_type: string; config: unknown; task_template_id?: string | null }>,
    allEdges: Array<{ source_node_id: string; target_node_id: string; source_handle?: string | null }>,
    context: ExecutionContext
  ): Promise<void> => {
    const nodeType = node.node_type as WorkflowNodeType;
    const config = node.config as WorkflowNodeConfig;

    // Log the node processing
    await appendExecutionLog(runId, node.id, 'node_entered', { node_type: nodeType });

    switch (nodeType) {
      case 'start':
        // Start node: just move to the next node
        await moveToNextNode(runId, node.id, allNodes, allEdges, context);
        break;

      case 'end':
        // End node: complete the workflow
        await completeWorkflow(runId, 'completed');
        break;

      case 'task':
        // Task node: create the task and wait (don't auto-advance)
        await handleTaskNode(runId, node, config, context);
        break;

      case 'validation':
        // Validation node: create validation instance and wait
        await handleValidationNode(runId, node, config as ValidationNodeConfig, context);
        break;

      case 'notification':
        // Notification node: send notification and move on
        await handleNotificationNode(runId, node, config as NotificationNodeConfig, context);
        await moveToNextNode(runId, node.id, allNodes, allEdges, context);
        break;

      case 'condition':
        // Condition node: evaluate and branch
        await handleConditionNode(runId, node, config, allNodes, allEdges, context);
        break;
    }
  };

  // Move to the next node based on edges
  const moveToNextNode = async (
    runId: string,
    currentNodeId: string,
    allNodes: Array<{ id: string; node_type: string; config: unknown; task_template_id?: string | null }>,
    allEdges: Array<{ source_node_id: string; target_node_id: string; source_handle?: string | null }>,
    context: ExecutionContext,
    branchHandle?: string
  ): Promise<void> => {
    // Find outgoing edges
    let outgoingEdges = allEdges.filter(e => e.source_node_id === currentNodeId);
    
    // If branch handle specified, filter by it
    if (branchHandle) {
      outgoingEdges = outgoingEdges.filter(e => e.source_handle === branchHandle);
    }

    if (outgoingEdges.length === 0) {
      // No outgoing edges, this is an error unless we're at an end node
      console.warn('No outgoing edges from node:', currentNodeId);
      return;
    }

    // Take the first edge (for now, simple sequential flow)
    const nextEdge = outgoingEdges[0];
    const nextNode = allNodes.find(n => n.id === nextEdge.target_node_id);

    if (!nextNode) {
      console.error('Next node not found:', nextEdge.target_node_id);
      return;
    }

    // Update current node in run
    await supabase
      .from('workflow_runs')
      .update({ current_node_id: nextNode.id })
      .eq('id', runId);

    // Process the next node
    await processNode(runId, nextNode, allNodes, allEdges, context);
  };

  // Handle task node
  const handleTaskNode = async (
    runId: string,
    node: { id: string; task_template_id?: string | null },
    config: unknown,
    context: ExecutionContext
  ): Promise<void> => {
    // For now, just log that we're at a task node
    // The task creation is handled separately when the request is created
    await appendExecutionLog(runId, node.id, 'task_node_reached', {
      task_template_id: node.task_template_id,
      config
    });

    // Update run to be waiting at this node
    await supabase
      .from('workflow_runs')
      .update({ 
        current_node_id: node.id,
        status: 'running' as const
      })
      .eq('id', runId);
  };

  // Handle validation node
  const handleValidationNode = async (
    runId: string,
    node: { id: string },
    config: ValidationNodeConfig,
    context: ExecutionContext
  ): Promise<void> => {
    // Determine approver based on config
    let approverId: string | null = null;

    switch (config.approver_type) {
      case 'user':
        approverId = config.approver_id || null;
        break;
      case 'requester_manager':
        // Get requester's manager
        if (context.requester_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('manager_id')
            .eq('id', context.requester_id)
            .single();
          approverId = profile?.manager_id || null;
        }
        break;
      case 'target_manager':
        approverId = context.manager_id || null;
        break;
      case 'department':
        // For department approval, we need to find someone in the department
        // This is a placeholder - real implementation would need more logic
        break;
    }

    // Calculate due date if SLA specified
    const dueAt = config.sla_hours 
      ? new Date(Date.now() + config.sla_hours * 60 * 60 * 1000).toISOString()
      : null;

    // Create validation instance
    const validationData = {
      run_id: runId,
      node_id: node.id,
      approver_type: config.approver_type,
      approver_id: approverId,
      approver_role: config.approver_role || null,
      status: 'pending' as const,
      due_at: dueAt,
    };

    const { error } = await supabase
      .from('workflow_validation_instances')
      .insert([validationData]);

    if (error) {
      console.error('Error creating validation instance:', error);
    }

    // Update run status
    await supabase
      .from('workflow_runs')
      .update({ 
        current_node_id: node.id,
        status: 'paused' as const
      })
      .eq('id', runId);

    await appendExecutionLog(runId, node.id, 'validation_created', {
      approver_type: config.approver_type,
      approver_id: approverId,
      due_at: dueAt
    });
  };

  // Handle notification node
  const handleNotificationNode = async (
    runId: string,
    node: { id: string },
    config: NotificationNodeConfig,
    context: ExecutionContext
  ): Promise<void> => {
    // Create notifications for each channel
    for (const channel of config.channels) {
      // Determine recipient
      let recipientId: string | null = null;
      let recipientEmail: string | null = null;

      switch (config.recipient_type) {
        case 'requester':
          recipientId = context.requester_id || null;
          break;
        case 'assignee':
          recipientId = context.assignee_id || null;
          break;
        case 'user':
          recipientId = config.recipient_id || null;
          break;
        case 'email':
          recipientEmail = config.recipient_email || null;
          break;
      }

      // Replace template variables
      const subject = replaceTemplateVariables(config.subject_template, context);
      const body = replaceTemplateVariables(config.body_template, context);
      const actionUrl = config.action_url_template 
        ? replaceTemplateVariables(config.action_url_template, context)
        : null;

      const notificationData = {
        run_id: runId,
        node_id: node.id,
        channel: channel,
        recipient_type: config.recipient_type,
        recipient_id: recipientId,
        recipient_email: recipientEmail,
        subject,
        body,
        action_url: actionUrl,
        status: 'pending' as const,
      };

      await supabase
        .from('workflow_notifications')
        .insert([notificationData]);
    }

    await appendExecutionLog(runId, node.id, 'notifications_created', {
      channels: config.channels,
      recipient_type: config.recipient_type
    });
  };

  // Handle condition node
  const handleConditionNode = async (
    runId: string,
    node: { id: string; config: unknown },
    config: unknown,
    allNodes: Array<{ id: string; node_type: string; config: unknown; task_template_id?: string | null }>,
    allEdges: Array<{ source_node_id: string; target_node_id: string; source_handle?: string | null }>,
    context: ExecutionContext
  ): Promise<void> => {
    // Simple condition evaluation based on context fields
    const conditionConfig = config as {
      field: string;
      operator: string;
      value?: string | number | boolean;
    };

    const contextRecord = context as unknown as Record<string, unknown>;
    const fieldValue = (context.custom_fields?.[conditionConfig.field] || 
                        contextRecord[conditionConfig.field]);
    
    let result = false;
    switch (conditionConfig.operator) {
      case 'equals':
        result = fieldValue === conditionConfig.value;
        break;
      case 'not_equals':
        result = fieldValue !== conditionConfig.value;
        break;
      case 'contains':
        result = String(fieldValue).includes(String(conditionConfig.value));
        break;
      case 'greater_than':
        result = Number(fieldValue) > Number(conditionConfig.value);
        break;
      case 'less_than':
        result = Number(fieldValue) < Number(conditionConfig.value);
        break;
      case 'is_empty':
        result = !fieldValue || fieldValue === '';
        break;
      case 'is_not_empty':
        result = !!fieldValue && fieldValue !== '';
        break;
    }

    await appendExecutionLog(runId, node.id, 'condition_evaluated', {
      field: conditionConfig.field,
      operator: conditionConfig.operator,
      value: conditionConfig.value,
      result
    });

    // Move to the appropriate branch
    const branchHandle = result ? 'true' : 'false';
    await moveToNextNode(runId, node.id, allNodes, allEdges, context, branchHandle);
  };

  // Complete a workflow run
  const completeWorkflow = async (
    runId: string, 
    status: 'completed' | 'failed' | 'cancelled'
  ): Promise<void> => {
    await supabase
      .from('workflow_runs')
      .update({
        status,
        completed_at: new Date().toISOString()
      })
      .eq('id', runId);

    await appendExecutionLog(runId, '', 'workflow_completed', { status });
  };

  // Append to execution log
  const appendExecutionLog = async (
    runId: string,
    nodeId: string,
    action: string,
    details?: Record<string, unknown>
  ): Promise<void> => {
    // Get current log
    const { data: run } = await supabase
      .from('workflow_runs')
      .select('execution_log')
      .eq('id', runId)
      .single();

    if (!run) return;

    const currentLog = (run.execution_log as Array<{
      timestamp: string;
      node_id: string;
      action: string;
      details?: Record<string, unknown>;
    }>) || [];

    const newEntry = {
      timestamp: new Date().toISOString(),
      node_id: nodeId,
      action,
      details
    };

    await supabase
      .from('workflow_runs')
      .update({ 
        execution_log: [...currentLog, newEntry] as unknown as Json 
      })
      .eq('id', runId);
  };

  // Process a validation decision
  const processValidationDecision = useCallback(async (
    validationId: string,
    decision: 'approved' | 'rejected',
    comment?: string
  ): Promise<boolean> => {
    if (!user) return false;

    setIsExecuting(true);
    try {
      // Update the validation instance
      const { data: validation, error: validationError } = await supabase
        .from('workflow_validation_instances')
        .update({
          status: decision,
          decision_comment: comment || null,
          decided_by: user.id,
          decided_at: new Date().toISOString()
        })
        .eq('id', validationId)
        .select('*, workflow_runs(*)')
        .single();

      if (validationError) throw validationError;

      // Get the run and check if we should continue
      const runId = validation.run_id;
      const nodeId = validation.node_id;

      // Get workflow data
      const [{ data: nodes }, { data: edges }, { data: run }] = await Promise.all([
        supabase.from('workflow_nodes').select('*').eq('workflow_id', (validation.workflow_runs as { workflow_id: string }).workflow_id),
        supabase.from('workflow_edges').select('*').eq('workflow_id', (validation.workflow_runs as { workflow_id: string }).workflow_id),
        supabase.from('workflow_runs').select('context_data').eq('id', runId).single(),
      ]);

      if (!nodes || !edges || !run) {
        throw new Error('Could not retrieve workflow data');
      }

      await appendExecutionLog(runId, nodeId, 'validation_decided', {
        decision,
        comment,
        decided_by: user.id
      });

      // If approved, move to the next node
      if (decision === 'approved') {
        const currentNode = nodes.find(n => n.id === nodeId);
        if (currentNode) {
          await moveToNextNode(
            runId, 
            nodeId, 
            nodes.map(n => ({
              id: n.id,
              node_type: n.node_type,
              config: n.config,
              task_template_id: n.task_template_id
            })),
            edges.map(e => ({
              source_node_id: e.source_node_id,
              target_node_id: e.target_node_id,
              source_handle: e.source_handle
            })),
            run.context_data as unknown as ExecutionContext
          );
        }
      } else {
        // If rejected, we might want to end the workflow or handle differently
        await completeWorkflow(runId, 'failed');
      }

      toast.success(decision === 'approved' ? 'Validation approuvée' : 'Validation refusée');
      return true;
    } catch (error) {
      console.error('Error processing validation:', error);
      toast.error('Erreur lors du traitement de la validation');
      return false;
    } finally {
      setIsExecuting(false);
    }
  }, [user]);

  // Get pending validations for the current user
  const getPendingValidations = useCallback(async (): Promise<WorkflowValidationInstance[]> => {
    if (!user) return [];

    try {
      // Get the current user's profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return [];

      // Get validations where user is an approver
      const { data, error } = await supabase
        .from('workflow_validation_instances')
        .select('*')
        .eq('status', 'pending')
        .eq('approver_id', profile.id);

      if (error) throw error;

      return (data || []).map(v => ({
        ...v,
        status: v.status as ValidationInstanceStatus,
        approver_type: v.approver_type as ApproverType,
        trigger_mode: (v.trigger_mode || 'auto') as ValidationTriggerMode,
        prerequisite_config: v.prerequisite_config as unknown as ValidationPrerequisite[] | null,
      })) as WorkflowValidationInstance[];
    } catch (error) {
      console.error('Error fetching pending validations:', error);
      return [];
    }
  }, [user]);

  return {
    isExecuting,
    startWorkflow,
    processValidationDecision,
    getPendingValidations,
  };
}

// Helper function to replace template variables
function replaceTemplateVariables(
  template: string, 
  context: ExecutionContext
): string {
  return template
    .replace(/{entity_type}/g, context.entityType)
    .replace(/{entity_id}/g, context.entityId)
    .replace(/{requester_id}/g, context.requester_id || '')
    .replace(/{assignee_id}/g, context.assignee_id || '')
    .replace(/{department_id}/g, context.department_id || '');
}
