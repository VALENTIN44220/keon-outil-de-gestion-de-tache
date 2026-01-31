import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

interface SubProcessInfo {
  id: string;
  name: string;
  assignment_type: string;
  target_manager_id: string | null;
  target_assignee_id: string | null;
  target_department_id: string | null;
  target_group_id: string | null;
  is_mandatory: boolean;
}

type NodeType = "condition" | "end" | "fork" | "join" | "notification" | "start" | "sub_process" | "task" | "validation" | "status_change" | "assignment" | "set_variable" | "datalake_sync" | "sub_process_standard_direct" | "sub_process_standard_manager" | "sub_process_standard_validation1" | "sub_process_standard_validation2";

/**
 * Generates a standard workflow for a process with compact sub_process_standard blocks.
 * This creates an executable workflow that follows the S1-S4 pattern.
 * 
 * Structure:
 * Start → Init Variables → Notif Creation → Fork (if multiple) → 
 * [Sub-process Standard Blocks] → Join → Notif Closure → End
 */
export async function generateStandardProcessWorkflow(
  processId: string,
  processName: string,
  userId: string
): Promise<string | null> {
  try {
    // Fetch sub-processes with their configuration
    const { data: subProcesses } = await supabase
      .from('sub_process_templates')
      .select(`
        id,
        name,
        assignment_type,
        target_manager_id,
        target_assignee_id,
        target_department_id,
        target_group_id,
        is_mandatory
      `)
      .eq('process_template_id', processId)
      .order('order_index');

    if (!subProcesses || subProcesses.length === 0) {
      console.warn('No sub-processes found for process:', processId);
      return null;
    }

    // Create the workflow template
    const { data: workflow, error: workflowError } = await supabase
      .from('workflow_templates')
      .insert({
        name: `Workflow Standard - ${processName}`,
        description: `Workflow auto-généré pour le processus "${processName}". ` +
          `Contient ${subProcesses.length} sous-processus avec blocs standards.`,
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

    // Build nodes
    const nodes: Array<{
      workflow_id: string;
      node_type: NodeType;
      label: string;
      position_x: number;
      position_y: number;
      config: Json;
    }> = [];

    const xSpacing = 280;
    const ySpacing = 120;
    const baseY = 300;
    let xPosition = 100;

    const useForkJoin = subProcesses.length > 1;

    // ========== START ==========
    nodes.push({
      workflow_id: workflow.id,
      node_type: 'start',
      label: 'Déclencheur',
      position_x: xPosition,
      position_y: baseY,
      config: { trigger: 'on_create' } as Json,
    });
    xPosition += xSpacing;

    // ========== NOTIFICATION: Creation ==========
    nodes.push({
      workflow_id: workflow.id,
      node_type: 'notification',
      label: 'Notif création (S2)',
      position_x: xPosition,
      position_y: baseY,
      config: {
        channels: ['in_app'],
        recipient_type: 'requester',
        subject_template: `[${processName}] Demande créée`,
        body_template: `Votre demande a été créée et est en cours de traitement.`,
        action_url_template: '/requests',
      } as Json,
    });
    xPosition += xSpacing;

    // ========== FORK (if multiple sub-processes) ==========
    if (useForkJoin) {
      nodes.push({
        workflow_id: workflow.id,
        node_type: 'fork',
        label: 'FORK',
        position_x: xPosition,
        position_y: baseY,
        config: {
          branch_mode: 'dynamic',
          branch_labels: subProcesses.map(sp => sp.name),
          from_sub_processes: true,
          sub_process_ids: subProcesses.map(sp => sp.id),
        } as Json,
      });
      xPosition += xSpacing;

      // Calculate vertical positions
      const totalHeight = (subProcesses.length - 1) * ySpacing;
      const startY = baseY - totalHeight / 2;

      // ========== SUB-PROCESS STANDARD BLOCKS ==========
      for (let i = 0; i < subProcesses.length; i++) {
        const sp = subProcesses[i];
        const nodeType = getStandardBlockType(sp);
        
        nodes.push({
          workflow_id: workflow.id,
          node_type: nodeType,
          label: sp.name,
          position_x: xPosition,
          position_y: startY + i * ySpacing,
          config: {
            sub_process_template_id: sp.id,
            sub_process_name: sp.name,
            assignment_type: sp.assignment_type,
            target_manager_id: sp.target_manager_id,
            target_assignee_id: sp.target_assignee_id,
            target_department_id: sp.target_department_id,
            target_group_id: sp.target_group_id,
            is_mandatory: sp.is_mandatory,
            branch_index: i,
            // Standard block config
            create_tasks_on_start: true,
            initial_status: sp.assignment_type === 'user' ? 'todo' : 'to_assign',
            notify_on_create: true,
            notify_on_status_change: true,
            notify_on_close: true,
          } as Json,
        });
      }
      xPosition += xSpacing;

      // ========== JOIN ==========
      nodes.push({
        workflow_id: workflow.id,
        node_type: 'join',
        label: 'JOIN',
        position_x: xPosition,
        position_y: baseY,
        config: {
          join_type: 'dynamic',
          required_count: subProcesses.length,
          input_count: subProcesses.length,
          from_sub_processes: true,
          sub_process_ids: subProcesses.map(sp => sp.id),
        } as Json,
      });
      xPosition += xSpacing;

    } else {
      // Single sub-process - no fork/join needed
      const sp = subProcesses[0];
      const nodeType = getStandardBlockType(sp);
      
      nodes.push({
        workflow_id: workflow.id,
        node_type: nodeType,
        label: sp.name,
        position_x: xPosition,
        position_y: baseY,
        config: {
          sub_process_template_id: sp.id,
          sub_process_name: sp.name,
          assignment_type: sp.assignment_type,
          target_manager_id: sp.target_manager_id,
          target_assignee_id: sp.target_assignee_id,
          target_department_id: sp.target_department_id,
          target_group_id: sp.target_group_id,
          is_mandatory: sp.is_mandatory,
          create_tasks_on_start: true,
          initial_status: sp.assignment_type === 'user' ? 'todo' : 'to_assign',
          notify_on_create: true,
          notify_on_status_change: true,
          notify_on_close: true,
        } as Json,
      });
      xPosition += xSpacing;
    }

    // ========== NOTIFICATION: Closure ==========
    nodes.push({
      workflow_id: workflow.id,
      node_type: 'notification',
      label: 'Notif clôture (S4)',
      position_x: xPosition,
      position_y: baseY,
      config: {
        channels: ['in_app'],
        recipient_type: 'requester',
        subject_template: `[${processName}] Demande clôturée`,
        body_template: `Votre demande a été traitée avec succès.`,
        action_url_template: '/requests',
      } as Json,
    });
    xPosition += xSpacing;

    // ========== END ==========
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

    // Create edges
    const edges = createEdges(workflow.id, insertedNodes, useForkJoin);

    if (edges.length > 0) {
      const { error: edgesError } = await supabase.from('workflow_edges').insert(edges);
      if (edgesError) {
        console.error('Error creating edges:', edgesError);
      }
    }

    return workflow.id;
  } catch (error) {
    console.error('Error in generateStandardProcessWorkflow:', error);
    return null;
  }
}

/**
 * Determines the standard block type based on sub-process configuration
 */
function getStandardBlockType(sp: SubProcessInfo): NodeType {
  // Check if it has validation configuration
  // For now, we determine based on assignment type
  const hasDirectAssignment = sp.assignment_type === 'user' || sp.target_assignee_id;
  const hasManagerAssignment = sp.assignment_type === 'manager';
  const hasGroupAssignment = sp.assignment_type === 'group';

  // Default to the appropriate standard block
  if (hasDirectAssignment) {
    return 'sub_process_standard_direct';
  } else if (hasManagerAssignment) {
    return 'sub_process_standard_manager';
  } else {
    // Default to manager-based if unclear
    return 'sub_process_standard_manager';
  }
}

/**
 * Creates edges between nodes
 */
function createEdges(
  workflowId: string,
  nodes: Array<{ id: string; node_type: string; position_y: number }>,
  useForkJoin: boolean
): Array<{
  workflow_id: string;
  source_node_id: string;
  target_node_id: string;
  animated: boolean;
  source_handle?: string;
}> {
  const edges: Array<{
    workflow_id: string;
    source_node_id: string;
    target_node_id: string;
    animated: boolean;
    source_handle?: string;
  }> = [];

  const startNode = nodes.find(n => n.node_type === 'start');
  const creationNotif = nodes.find(n => n.node_type === 'notification' && nodes.indexOf(n) < 3);
  const forkNode = nodes.find(n => n.node_type === 'fork');
  const joinNode = nodes.find(n => n.node_type === 'join');
  const subProcessNodes = nodes.filter(n => n.node_type.startsWith('sub_process'));
  const closureNotif = nodes.find(n => 
    n.node_type === 'notification' && 
    nodes.indexOf(n) > nodes.indexOf(subProcessNodes[0] || nodes[0])
  );
  const endNode = nodes.find(n => n.node_type === 'end');

  // Start -> Creation Notif
  if (startNode && creationNotif) {
    edges.push({
      workflow_id: workflowId,
      source_node_id: startNode.id,
      target_node_id: creationNotif.id,
      animated: true,
    });
  }

  if (useForkJoin && forkNode && joinNode) {
    // Creation Notif -> Fork
    if (creationNotif) {
      edges.push({
        workflow_id: workflowId,
        source_node_id: creationNotif.id,
        target_node_id: forkNode.id,
        animated: true,
      });
    }

    // Fork -> Sub-processes (with handle indices)
    subProcessNodes.forEach((sp, index) => {
      edges.push({
        workflow_id: workflowId,
        source_node_id: forkNode.id,
        target_node_id: sp.id,
        animated: true,
        source_handle: `branch-${index}`,
      });
    });

    // Sub-processes -> Join
    subProcessNodes.forEach((sp) => {
      edges.push({
        workflow_id: workflowId,
        source_node_id: sp.id,
        target_node_id: joinNode.id,
        animated: true,
      });
    });

    // Join -> Closure Notif
    if (closureNotif) {
      edges.push({
        workflow_id: workflowId,
        source_node_id: joinNode.id,
        target_node_id: closureNotif.id,
        animated: true,
      });
    }
  } else {
    // Linear flow: Creation Notif -> Sub-process -> Closure Notif
    if (creationNotif && subProcessNodes[0]) {
      edges.push({
        workflow_id: workflowId,
        source_node_id: creationNotif.id,
        target_node_id: subProcessNodes[0].id,
        animated: true,
      });
    }

    if (subProcessNodes[0] && closureNotif) {
      edges.push({
        workflow_id: workflowId,
        source_node_id: subProcessNodes[0].id,
        target_node_id: closureNotif.id,
        animated: true,
      });
    }
  }

  // Closure Notif -> End
  if (closureNotif && endNode) {
    edges.push({
      workflow_id: workflowId,
      source_node_id: closureNotif.id,
      target_node_id: endNode.id,
      animated: true,
    });
  }

  return edges;
}

/**
 * Generates a standard workflow for a sub-process (S1-S4 pattern)
 */
export async function generateStandardSubProcessWorkflow(
  subProcessId: string,
  subProcessName: string,
  userId: string,
  config: {
    assignment_type: string;
    target_manager_id?: string | null;
    target_assignee_id?: string | null;
    target_department_id?: string | null;
    validation_levels?: number;
  }
): Promise<string | null> {
  try {
    const isDirectAssignment = config.assignment_type === 'user' || config.target_assignee_id;
    const initialStatus = isDirectAssignment ? 'todo' : 'to_assign';
    const validationLevels = config.validation_levels || 0;

    // Fetch task templates
    const { data: tasks } = await supabase
      .from('task_templates')
      .select('id, title, default_duration_days')
      .eq('sub_process_template_id', subProcessId)
      .order('order_index');

    // Create workflow template
    const { data: workflow, error: workflowError } = await supabase
      .from('workflow_templates')
      .insert({
        name: `Workflow Standard - ${subProcessName}`,
        description: `Workflow S1-S4 pour le sous-processus "${subProcessName}". ` +
          `Mode: ${isDirectAssignment ? 'Affectation directe' : 'Via manager'}. ` +
          `Validation: ${validationLevels} niveau(x).`,
        created_by: userId,
        is_default: true,
        status: 'draft' as const,
        sub_process_template_id: subProcessId,
        process_template_id: null,
      })
      .select()
      .single();

    if (workflowError || !workflow) {
      console.error('Error creating sub-process workflow:', workflowError);
      return null;
    }

    // Build nodes using a compact standard block
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
    const xSpacing = 280;

    // Start
    nodes.push({
      workflow_id: workflow.id,
      node_type: 'start',
      label: 'Déclencheur (S1)',
      position_x: xPosition,
      position_y: yPosition,
      config: { trigger: 'on_create' } as Json,
    });
    xPosition += xSpacing;

    // Determine the standard block type
    let standardBlockType: NodeType;
    if (validationLevels === 0) {
      standardBlockType = isDirectAssignment ? 'sub_process_standard_direct' : 'sub_process_standard_manager';
    } else if (validationLevels === 1) {
      standardBlockType = 'sub_process_standard_validation1';
    } else {
      standardBlockType = 'sub_process_standard_validation2';
    }

    // Standard block (encapsulates S1-S4)
    nodes.push({
      workflow_id: workflow.id,
      node_type: standardBlockType,
      label: `Exécution: ${subProcessName}`,
      position_x: xPosition,
      position_y: yPosition,
      config: {
        sub_process_template_id: subProcessId,
        sub_process_name: subProcessName,
        assignment_type: config.assignment_type,
        target_manager_id: config.target_manager_id || null,
        target_assignee_id: config.target_assignee_id || null,
        target_department_id: config.target_department_id || null,
        task_template_ids: tasks?.map(t => t.id) || [],
        initial_status: initialStatus,
        validation_levels: validationLevels,
        // S1-S4 config
        s1_create_tasks: true,
        s2_notify_creation: true,
        s3_notify_status_changes: true,
        s4_notify_closure: true,
        notification_channels: ['in_app'],
      } as Json,
    });
    xPosition += xSpacing;

    // End
    nodes.push({
      workflow_id: workflow.id,
      node_type: 'end',
      label: 'Fin',
      position_x: xPosition,
      position_y: yPosition,
      config: { final_status: 'completed' } as Json,
    });

    // Insert nodes
    const { data: insertedNodes, error: nodesError } = await supabase
      .from('workflow_nodes')
      .insert(nodes)
      .select();

    if (nodesError || !insertedNodes) {
      console.error('Error creating sub-process nodes:', nodesError);
      return workflow.id;
    }

    // Create linear edges
    const edges = [];
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
    console.error('Error in generateStandardSubProcessWorkflow:', error);
    return null;
  }
}
