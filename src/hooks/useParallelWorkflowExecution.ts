import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { 
  ForkNodeConfig, 
  JoinNodeConfig, 
  BranchStatus,
  WorkflowBranchInstance,
} from '@/types/workflow';

interface ExecutionContext {
  entityType: 'task' | 'request';
  entityId: string;
  requester_id?: string;
  assignee_id?: string;
  department_id?: string;
  manager_id?: string;
  custom_fields?: Record<string, unknown>;
  selected_sub_processes?: string[];
}

interface NodeInfo {
  id: string;
  node_type: string;
  config: unknown;
  task_template_id?: string | null;
}

interface EdgeInfo {
  source_node_id: string;
  target_node_id: string;
  source_handle?: string | null;
}

// Handle Fork node - starts parallel branches
export async function handleForkNode(
  runId: string,
  node: NodeInfo,
  config: ForkNodeConfig,
  allNodes: NodeInfo[],
  allEdges: EdgeInfo[],
  context: ExecutionContext
): Promise<void> {
  const branchIds: string[] = [];
  
  if (config.branch_mode === 'dynamic' && config.from_sub_processes) {
    // Create branches from selected sub-processes
    const selectedSubProcesses = context.selected_sub_processes || [];
    
    for (const subProcessId of selectedSubProcesses) {
      const branchId = `sp_${subProcessId}`;
      branchIds.push(branchId);
      
      // Create branch instance
      await supabase
        .from('workflow_branch_instances')
        .insert({
          run_id: runId,
          branch_id: branchId,
          fork_node_id: node.id,
          status: 'running' as BranchStatus,
          context_data: { 
            ...context, 
            sub_process_id: subProcessId 
          } as unknown as Json,
        });
    }
  } else if (config.branches && config.branches.length > 0) {
    // Static branches
    for (const branch of config.branches) {
      // Check condition if any
      let shouldActivate = true;
      if (branch.condition) {
        shouldActivate = evaluateSimpleCondition(branch.condition, context);
      }
      
      if (shouldActivate) {
        branchIds.push(branch.id);
        
        await supabase
          .from('workflow_branch_instances')
          .insert({
            run_id: runId,
            branch_id: branch.id,
            fork_node_id: node.id,
            status: 'running' as BranchStatus,
            context_data: { 
              ...context, 
              branch_name: branch.name 
            } as unknown as Json,
          });
      }
    }
  }

  // Update workflow run with active branches
  const branchStatuses: Record<string, BranchStatus> = {};
  branchIds.forEach(id => { branchStatuses[id] = 'running'; });

  await supabase
    .from('workflow_runs')
    .update({
      active_branches: branchIds,
      completed_branches: [],
      branch_statuses: branchStatuses as unknown as Json,
    })
    .eq('id', runId);

  // Find outgoing edges and start each branch
  const outgoingEdges = allEdges.filter(e => e.source_node_id === node.id);
  
  for (const edge of outgoingEdges) {
    const targetNode = allNodes.find(n => n.id === edge.target_node_id);
    if (targetNode) {
      // Determine which branch this edge belongs to
      const branchHandle = edge.source_handle;
      const branchId = branchHandle || branchIds[0]; // Fallback to first branch
      
      // Update branch's current node
      await supabase
        .from('workflow_branch_instances')
        .update({ current_node_id: targetNode.id })
        .eq('run_id', runId)
        .eq('branch_id', branchId);
    }
  }

  await appendExecutionLog(runId, node.id, 'fork_started', {
    branch_ids: branchIds,
    branch_mode: config.branch_mode,
  });
}

// Handle Join node - synchronizes parallel branches
export async function handleJoinNode(
  runId: string,
  node: NodeInfo,
  config: JoinNodeConfig,
  allNodes: NodeInfo[],
  allEdges: EdgeInfo[],
  context: ExecutionContext
): Promise<{ canProceed: boolean; completedCount: number; totalCount: number }> {
  // Get current branch statuses
  const { data: run } = await supabase
    .from('workflow_runs')
    .select('active_branches, completed_branches, branch_statuses')
    .eq('id', runId)
    .single();

  if (!run) {
    return { canProceed: false, completedCount: 0, totalCount: 0 };
  }

  const activeBranches = (run.active_branches as string[]) || [];
  const completedBranches = (run.completed_branches as string[]) || [];
  const branchStatuses = (run.branch_statuses as Record<string, BranchStatus>) || {};

  const totalBranches = activeBranches.length + completedBranches.length;
  const completedCount = completedBranches.length;

  let canProceed = false;

  switch (config.join_type) {
    case 'and':
      // All branches must be complete
      canProceed = completedCount === totalBranches && totalBranches > 0;
      break;
    
    case 'or':
      // At least one branch must be complete
      canProceed = completedCount >= 1;
      break;
    
    case 'n_of_m':
      // Specific number must be complete
      const required = config.required_count || 1;
      canProceed = completedCount >= required;
      break;
  }

  // Check for specific required branches
  if (canProceed && config.required_branch_ids && config.required_branch_ids.length > 0) {
    const allRequiredComplete = config.required_branch_ids.every(
      branchId => completedBranches.includes(branchId)
    );
    canProceed = canProceed && allRequiredComplete;
  }

  await appendExecutionLog(runId, node.id, 'join_check', {
    join_type: config.join_type,
    completed_count: completedCount,
    total_count: totalBranches,
    can_proceed: canProceed,
  });

  if (canProceed) {
    // Clear branch tracking as we're moving past the join
    await supabase
      .from('workflow_runs')
      .update({
        active_branches: [],
        completed_branches: [],
        branch_statuses: {} as unknown as Json,
        current_node_id: node.id,
      })
      .eq('id', runId);
  }

  return { canProceed, completedCount, totalCount: totalBranches };
}

// Mark a branch as complete
export async function completeBranch(
  runId: string,
  branchId: string
): Promise<void> {
  // Get current state
  const { data: run } = await supabase
    .from('workflow_runs')
    .select('active_branches, completed_branches, branch_statuses')
    .eq('id', runId)
    .single();

  if (!run) return;

  const activeBranches = ((run.active_branches as string[]) || []).filter(id => id !== branchId);
  const completedBranches = [...((run.completed_branches as string[]) || []), branchId];
  const branchStatuses = { ...(run.branch_statuses as Record<string, BranchStatus>) || {} };
  branchStatuses[branchId] = 'completed';

  await supabase
    .from('workflow_runs')
    .update({
      active_branches: activeBranches,
      completed_branches: completedBranches,
      branch_statuses: branchStatuses as unknown as Json,
    })
    .eq('id', runId);

  // Update branch instance
  await supabase
    .from('workflow_branch_instances')
    .update({
      status: 'completed' as BranchStatus,
      completed_at: new Date().toISOString(),
    })
    .eq('run_id', runId)
    .eq('branch_id', branchId);

  await appendExecutionLog(runId, '', 'branch_completed', { branch_id: branchId });
}

// Get branch instances for a run
export async function getBranchInstances(runId: string): Promise<WorkflowBranchInstance[]> {
  const { data, error } = await supabase
    .from('workflow_branch_instances')
    .select('*')
    .eq('run_id', runId);

  if (error) {
    console.error('Error fetching branch instances:', error);
    return [];
  }

  return (data || []).map(b => ({
    ...b,
    status: b.status as BranchStatus,
    context_data: (b.context_data as Record<string, unknown>) || {},
  })) as WorkflowBranchInstance[];
}

// Helper: Simple condition evaluation
function evaluateSimpleCondition(condition: string, context: ExecutionContext): boolean {
  try {
    // Very simple condition parsing: "field == value" or "field != value"
    const parts = condition.split(/\s*(==|!=|>|<)\s*/);
    if (parts.length !== 3) return true;
    
    const [field, operator, value] = parts;
    const contextRecord = context as unknown as Record<string, unknown>;
    const actualValue = context.custom_fields?.[field] ?? contextRecord[field];
    
    switch (operator) {
      case '==': return String(actualValue) === value;
      case '!=': return String(actualValue) !== value;
      case '>': return Number(actualValue) > Number(value);
      case '<': return Number(actualValue) < Number(value);
      default: return true;
    }
  } catch {
    return true;
  }
}

// Helper: Append to execution log
async function appendExecutionLog(
  runId: string,
  nodeId: string,
  action: string,
  details?: Record<string, unknown>
): Promise<void> {
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
}
