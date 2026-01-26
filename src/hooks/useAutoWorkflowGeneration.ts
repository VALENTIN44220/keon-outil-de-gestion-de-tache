import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

interface TaskTemplateForWorkflow {
  id: string;
  title: string;
  default_duration_days?: number | null;
}

/**
 * Creates a default workflow for a sub-process template with its tasks
 */
export async function createSubProcessWorkflow(
  subProcessId: string,
  subProcessName: string,
  userId: string,
  tasks: TaskTemplateForWorkflow[] = []
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

    // Start node
    nodes.push({
      workflow_id: workflow.id,
      node_type: 'start',
      label: 'Début',
      position_x: xPosition,
      position_y: yPosition,
      config: { trigger: 'on_create' } as Json,
    });
    xPosition += xSpacing;

    // Task nodes for each task template
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
        } as Json,
        task_template_id: task.id,
      });
      xPosition += xSpacing;
    }

    // End node
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

    let xPosition = 100;
    const yPosition = 200;
    const xSpacing = 250;

    // Start node
    nodes.push({
      workflow_id: workflow.id,
      node_type: 'start',
      label: 'Début',
      position_x: xPosition,
      position_y: yPosition,
      config: { trigger: 'on_create' } as Json,
    });
    xPosition += xSpacing;

    // Sub-process nodes
    for (const sp of subProcesses) {
      nodes.push({
        workflow_id: workflow.id,
        node_type: 'sub_process',
        label: sp.name,
        position_x: xPosition,
        position_y: yPosition,
        config: {
          sub_process_template_id: sp.id,
          sub_process_name: sp.name,
          execute_all_tasks: true,
        } as Json,
      });
      xPosition += xSpacing;
    }

    // End node
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

  // Fetch tasks for this sub-process
  const { data: tasks } = await supabase
    .from('task_templates')
    .select('id, title, default_duration_days')
    .eq('sub_process_template_id', subProcessId)
    .order('order_index');

  return createSubProcessWorkflow(subProcessId, subProcessName, userId, tasks || []);
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
