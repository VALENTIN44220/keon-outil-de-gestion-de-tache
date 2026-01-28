import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

interface TaskTemplateForWorkflow {
  id: string;
  title: string;
  default_duration_days?: number | null;
}

interface SubProcessInfo {
  target_manager_id?: string | null;
  target_department_id?: string | null;
  name?: string;
}

/**
 * Creates a complete workflow for a sub-process template
 * Includes: Start -> Tasks -> Validation Manager -> Notification -> End
 */
export async function createSubProcessWorkflow(
  subProcessId: string,
  subProcessName: string,
  userId: string,
  tasks: TaskTemplateForWorkflow[] = [],
  subProcessInfo?: SubProcessInfo
): Promise<string | null> {
  try {
    // Create the workflow template
    const { data: workflow, error: workflowError } = await supabase
      .from('workflow_templates')
      .insert({
        name: `Workflow - ${subProcessName}`,
        description: `Workflow automatique pour le sous-processus ${subProcessName}`,
        created_by: userId,
        is_default: true,
        status: 'draft' as const,
        sub_process_template_id: subProcessId,
        process_template_id: null,
      })
      .select()
      .single();

    if (workflowError || !workflow) {
      console.error('Error creating workflow:', workflowError);
      return null;
    }

    type NodeType = "condition" | "end" | "fork" | "join" | "notification" | "start" | "sub_process" | "task" | "validation";

    // Create nodes
    const nodes: Array<{
      workflow_id: string;
      node_type: NodeType;
      label: string;
      position_x: number;
      position_y: number;
      config: Json;
      task_template_id?: string;
    }> = [];

    let xPosition = 100;
    const yPosition = 200;
    const xSpacing = 250;

    // 1. START NODE - Trigger
    nodes.push({
      workflow_id: workflow.id,
      node_type: 'start',
      label: 'Déclencheur',
      position_x: xPosition,
      position_y: yPosition,
      config: { trigger: 'on_create' } as Json,
    });
    xPosition += xSpacing;

    // 2. TASK NODES - One for each task template
    if (tasks.length > 0) {
      for (const task of tasks) {
        nodes.push({
          workflow_id: workflow.id,
          node_type: 'task',
          label: task.title,
          position_x: xPosition,
          position_y: yPosition,
          config: {
            task_template_id: task.id,
            task_template_ids: [task.id],
            task_title: task.title,
            duration_days: task.default_duration_days || 5,
            responsible_type: 'assignee',
          } as Json,
          task_template_id: task.id,
        });
        xPosition += xSpacing;
      }
    } else {
      // Add a placeholder task node if no tasks exist
      nodes.push({
        workflow_id: workflow.id,
        node_type: 'task',
        label: 'Tâche principale',
        position_x: xPosition,
        position_y: yPosition,
        config: {
          task_title: 'Tâche principale',
          duration_days: 5,
          responsible_type: 'assignee',
        } as Json,
      });
      xPosition += xSpacing;
    }

    // 3. VALIDATION NODE - Manager validation
    nodes.push({
      workflow_id: workflow.id,
      node_type: 'validation',
      label: 'Validation Manager',
      position_x: xPosition,
      position_y: yPosition,
      config: {
        approver_type: subProcessInfo?.target_manager_id ? 'user' : 'requester_manager',
        approver_id: subProcessInfo?.target_manager_id || null,
        is_mandatory: true,
        approval_mode: 'single',
        sla_hours: 48,
        reminder_hours: 24,
        allow_delegation: true,
        on_timeout_action: 'notify',
        trigger_mode: 'auto',
      } as Json,
    });
    xPosition += xSpacing;

    // 4. NOTIFICATION NODE - Notify requester
    nodes.push({
      workflow_id: workflow.id,
      node_type: 'notification',
      label: 'Notification de clôture',
      position_x: xPosition,
      position_y: yPosition,
      config: {
        channels: ['in_app', 'email'],
        recipient_type: 'requester',
        subject_template: `[${subProcessName}] Demande traitée`,
        body_template: `Votre demande concernant "${subProcessName}" a été traitée et validée.\n\nMerci de votre confiance.`,
        action_url_template: '/requests',
      } as Json,
    });
    xPosition += xSpacing;

    // 5. END NODE
    nodes.push({
      workflow_id: workflow.id,
      node_type: 'end',
      label: 'Fin',
      position_x: xPosition,
      position_y: yPosition,
      config: { final_status: 'completed' } as Json,
    });

    // Insert all nodes
    const { data: insertedNodes, error: nodesError } = await supabase
      .from('workflow_nodes')
      .insert(nodes)
      .select();

    if (nodesError || !insertedNodes) {
      console.error('Error creating nodes:', nodesError);
      return workflow.id;
    }

    // Create edges to connect nodes sequentially
    const edges: Array<{
      workflow_id: string;
      source_node_id: string;
      target_node_id: string;
      animated: boolean;
      label?: string;
    }> = [];

    for (let i = 0; i < insertedNodes.length - 1; i++) {
      edges.push({
        workflow_id: workflow.id,
        source_node_id: insertedNodes[i].id,
        target_node_id: insertedNodes[i + 1].id,
        animated: true,
      });
    }

    if (edges.length > 0) {
      await supabase.from('workflow_edges').insert(edges);
    }

    return workflow.id;
  } catch (error) {
    console.error('Error in createSubProcessWorkflow:', error);
    return null;
  }
}

/**
 * Creates a default workflow for a process template with its sub-processes
 * Uses Fork/Join pattern when there are multiple sub-processes
 */
export async function createProcessWorkflow(
  processId: string,
  processName: string,
  userId: string,
  subProcesses: Array<{ id: string; name: string }> = []
): Promise<string | null> {
  try {
    // Create the workflow template
    const { data: workflow, error: workflowError } = await supabase
      .from('workflow_templates')
      .insert({
        name: `Workflow - ${processName}`,
        description: `Workflow automatique pour le processus ${processName}`,
        created_by: userId,
        is_default: true,
        status: 'draft' as const,
        process_template_id: processId,
        sub_process_template_id: null,
      })
      .select()
      .single();

    if (workflowError || !workflow) {
      console.error('Error creating workflow:', workflowError);
      return null;
    }

    type NodeType = "condition" | "end" | "fork" | "join" | "notification" | "start" | "sub_process" | "task" | "validation";

    // Create nodes
    const nodes: Array<{
      workflow_id: string;
      node_type: NodeType;
      label: string;
      position_x: number;
      position_y: number;
      config: Json;
    }> = [];

    const xSpacing = 250;
    const ySpacing = 120;
    const baseY = 300;
    let xPosition = 100;

    // If more than 1 sub-process, use Fork/Join pattern
    const useForkJoin = subProcesses.length > 1;

    // Start node
    nodes.push({
      workflow_id: workflow.id,
      node_type: 'start',
      label: 'Début',
      position_x: xPosition,
      position_y: baseY,
      config: { trigger: 'on_create' } as Json,
    });
    xPosition += xSpacing;

    if (useForkJoin) {
      // FORK node
      nodes.push({
        workflow_id: workflow.id,
        node_type: 'fork',
        label: 'FORK',
        position_x: xPosition,
        position_y: baseY,
        config: { 
          fork_type: 'static',
          branch_labels: subProcesses.map(sp => sp.name),
        } as Json,
      });
      xPosition += xSpacing;

      // Calculate vertical positions for sub-processes (centered around baseY)
      const totalHeight = (subProcesses.length - 1) * ySpacing;
      const startY = baseY - totalHeight / 2;

      // Sub-process nodes (parallel branches)
      for (let i = 0; i < subProcesses.length; i++) {
        const sp = subProcesses[i];
        nodes.push({
          workflow_id: workflow.id,
          node_type: 'sub_process',
          label: sp.name,
          position_x: xPosition,
          position_y: startY + i * ySpacing,
          config: {
            sub_process_template_id: sp.id,
            sub_process_name: sp.name,
            execute_all_tasks: true,
          } as Json,
        });
      }
      xPosition += xSpacing;

      // JOIN node
      nodes.push({
        workflow_id: workflow.id,
        node_type: 'join',
        label: 'JOIN',
        position_x: xPosition,
        position_y: baseY,
        config: { 
          join_type: 'all',
          required_count: subProcesses.length,
        } as Json,
      });
      xPosition += xSpacing;
    } else {
      // Single or no sub-process - linear flow
      for (const sp of subProcesses) {
        nodes.push({
          workflow_id: workflow.id,
          node_type: 'sub_process',
          label: sp.name,
          position_x: xPosition,
          position_y: baseY,
          config: {
            sub_process_template_id: sp.id,
            sub_process_name: sp.name,
            execute_all_tasks: true,
          } as Json,
        });
        xPosition += xSpacing;
      }
    }

    // End node
    nodes.push({
      workflow_id: workflow.id,
      node_type: 'end',
      label: 'Fin',
      position_x: xPosition,
      position_y: baseY,
      config: { final_status: 'completed' } as Json,
    });

    // Insert all nodes
    const { data: insertedNodes, error: nodesError } = await supabase
      .from('workflow_nodes')
      .insert(nodes)
      .select();

    if (nodesError || !insertedNodes) {
      console.error('Error creating nodes:', nodesError);
      return workflow.id;
    }

    // Create edges based on the pattern used
    const edges: Array<{
      workflow_id: string;
      source_node_id: string;
      target_node_id: string;
      animated: boolean;
      source_handle?: string;
      target_handle?: string;
    }> = [];

    if (useForkJoin) {
      // Find nodes by type
      const startNode = insertedNodes.find(n => n.node_type === 'start');
      const forkNode = insertedNodes.find(n => n.node_type === 'fork');
      const joinNode = insertedNodes.find(n => n.node_type === 'join');
      const endNode = insertedNodes.find(n => n.node_type === 'end');
      const subProcessNodes = insertedNodes.filter(n => n.node_type === 'sub_process');

      if (startNode && forkNode) {
        edges.push({
          workflow_id: workflow.id,
          source_node_id: startNode.id,
          target_node_id: forkNode.id,
          animated: true,
        });
      }

      // Connect fork to each sub-process
      subProcessNodes.forEach((spNode, index) => {
        if (forkNode) {
          edges.push({
            workflow_id: workflow.id,
            source_node_id: forkNode.id,
            target_node_id: spNode.id,
            animated: true,
            source_handle: `fork-out-${index}`,
          });
        }
        // Connect each sub-process to join
        if (joinNode) {
          edges.push({
            workflow_id: workflow.id,
            source_node_id: spNode.id,
            target_node_id: joinNode.id,
            animated: true,
            target_handle: `join-in-${index}`,
          });
        }
      });

      if (joinNode && endNode) {
        edges.push({
          workflow_id: workflow.id,
          source_node_id: joinNode.id,
          target_node_id: endNode.id,
          animated: true,
        });
      }
    } else {
      // Linear flow - connect nodes sequentially
      for (let i = 0; i < insertedNodes.length - 1; i++) {
        edges.push({
          workflow_id: workflow.id,
          source_node_id: insertedNodes[i].id,
          target_node_id: insertedNodes[i + 1].id,
          animated: true,
        });
      }
    }

    if (edges.length > 0) {
      await supabase.from('workflow_edges').insert(edges);
    }

    return workflow.id;
  } catch (error) {
    console.error('Error in createProcessWorkflow:', error);
    return null;
  }
}

/**
 * Ensures a sub-process has a workflow, creating one if it doesn't exist
 */
export async function ensureSubProcessWorkflow(
  subProcessId: string,
  subProcessName: string,
  userId: string
): Promise<string | null> {
  // Check if workflow already exists
  const { data: existingWorkflow } = await supabase
    .from('workflow_templates')
    .select('id')
    .eq('sub_process_template_id', subProcessId)
    .eq('is_default', true)
    .maybeSingle();

  if (existingWorkflow) {
    return existingWorkflow.id;
  }

  // Fetch sub-process info for manager configuration
  const { data: subProcessInfo } = await supabase
    .from('sub_process_templates')
    .select('target_manager_id, target_department_id')
    .eq('id', subProcessId)
    .maybeSingle();

  // Fetch tasks for this sub-process
  const { data: tasks } = await supabase
    .from('task_templates')
    .select('id, title, default_duration_days')
    .eq('sub_process_template_id', subProcessId)
    .order('order_index');

  return createSubProcessWorkflow(
    subProcessId, 
    subProcessName, 
    userId, 
    tasks || [],
    subProcessInfo || undefined
  );
}

/**
 * Ensures a process has a workflow, creating one if it doesn't exist
 */
export async function ensureProcessWorkflow(
  processId: string,
  processName: string,
  userId: string
): Promise<string | null> {
  // Check if workflow already exists
  const { data: existingWorkflow } = await supabase
    .from('workflow_templates')
    .select('id')
    .eq('process_template_id', processId)
    .eq('is_default', true)
    .maybeSingle();

  if (existingWorkflow) {
    return existingWorkflow.id;
  }

  // Fetch sub-processes
  const { data: subProcesses } = await supabase
    .from('sub_process_templates')
    .select('id, name')
    .eq('process_template_id', processId)
    .order('order_index');

  return createProcessWorkflow(processId, processName, userId, subProcesses || []);
}

/**
 * Adds a task node to an existing sub-process workflow
 */
export async function addTaskToWorkflow(
  subProcessId: string,
  taskId: string,
  taskTitle: string,
  durationDays: number = 5
): Promise<boolean> {
  try {
    // Get the workflow for this sub-process
    const { data: workflow } = await supabase
      .from('workflow_templates')
      .select('id')
      .eq('sub_process_template_id', subProcessId)
      .eq('is_default', true)
      .maybeSingle();

    if (!workflow) return false;

    // Find the end node to insert before it
    const { data: endNode } = await supabase
      .from('workflow_nodes')
      .select('id, position_x, position_y')
      .eq('workflow_id', workflow.id)
      .eq('node_type', 'end')
      .maybeSingle();

    if (!endNode) return false;

    // Find the edge that connects to the end node
    const { data: incomingEdge } = await supabase
      .from('workflow_edges')
      .select('id, source_node_id')
      .eq('workflow_id', workflow.id)
      .eq('target_node_id', endNode.id)
      .maybeSingle();

    // Create the new task node
    const newNodeX = endNode.position_x;
    const { data: newNode, error: nodeError } = await supabase
      .from('workflow_nodes')
      .insert({
        workflow_id: workflow.id,
        node_type: 'task',
        label: taskTitle,
        position_x: newNodeX,
        position_y: endNode.position_y,
        config: {
          task_template_id: taskId,
          task_template_ids: [taskId],
          task_title: taskTitle,
          duration_days: durationDays,
        } as Json,
        task_template_id: taskId,
      })
      .select()
      .single();

    if (nodeError || !newNode) return false;

    // Move the end node to the right
    await supabase
      .from('workflow_nodes')
      .update({ position_x: endNode.position_x + 250 })
      .eq('id', endNode.id);

    // Update the incoming edge to point to the new task
    if (incomingEdge) {
      await supabase
        .from('workflow_edges')
        .update({ target_node_id: newNode.id })
        .eq('id', incomingEdge.id);
    }

    // Create edge from new task to end
    await supabase.from('workflow_edges').insert({
      workflow_id: workflow.id,
      source_node_id: newNode.id,
      target_node_id: endNode.id,
      animated: true,
    });

    return true;
  } catch (error) {
    console.error('Error adding task to workflow:', error);
    return false;
  }
}

/**
 * Removes a task node from a workflow
 */
export async function removeTaskFromWorkflow(
  subProcessId: string,
  taskId: string
): Promise<boolean> {
  try {
    const { data: workflow } = await supabase
      .from('workflow_templates')
      .select('id')
      .eq('sub_process_template_id', subProcessId)
      .eq('is_default', true)
      .maybeSingle();

    if (!workflow) return false;

    // Find the task node
    const { data: taskNode } = await supabase
      .from('workflow_nodes')
      .select('id')
      .eq('workflow_id', workflow.id)
      .eq('task_template_id', taskId)
      .maybeSingle();

    if (!taskNode) return true; // Already gone

    // Find incoming and outgoing edges
    const [{ data: incomingEdges }, { data: outgoingEdges }] = await Promise.all([
      supabase
        .from('workflow_edges')
        .select('id, source_node_id')
        .eq('workflow_id', workflow.id)
        .eq('target_node_id', taskNode.id),
      supabase
        .from('workflow_edges')
        .select('id, target_node_id')
        .eq('workflow_id', workflow.id)
        .eq('source_node_id', taskNode.id),
    ]);

    // Re-connect the graph: connect incoming sources to outgoing targets
    if (incomingEdges?.length && outgoingEdges?.length) {
      for (const inEdge of incomingEdges) {
        for (const outEdge of outgoingEdges) {
          await supabase.from('workflow_edges').insert({
            workflow_id: workflow.id,
            source_node_id: inEdge.source_node_id,
            target_node_id: outEdge.target_node_id,
            animated: true,
          });
        }
      }
    }

    // Delete the edges connected to this node
    await supabase
      .from('workflow_edges')
      .delete()
      .or(`source_node_id.eq.${taskNode.id},target_node_id.eq.${taskNode.id}`);

    // Delete the node
    await supabase.from('workflow_nodes').delete().eq('id', taskNode.id);

    return true;
  } catch (error) {
    console.error('Error removing task from workflow:', error);
    return false;
  }
}
