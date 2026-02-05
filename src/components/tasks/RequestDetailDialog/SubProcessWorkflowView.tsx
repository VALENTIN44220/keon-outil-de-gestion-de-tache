import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, Flag, CheckSquare, ShieldCheck, Bell, GitBranch, Layers, Split, Merge, RefreshCw, UserPlus, Check, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkflowNode {
  id: string;
  node_type: string;
  label: string;
  position_x: number;
  position_y: number;
  config: Record<string, unknown>;
}

interface WorkflowEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle?: string | null;
  target_handle?: string | null;
}

interface ExecutionLogEntry {
  timestamp: string;
  node_id: string;
  action: string;
}

interface WorkflowRunData {
  id: string;
  current_node_id: string | null;
  status: string;
  execution_log: ExecutionLogEntry[];
}

interface SubProcessWorkflowViewProps {
  subProcessTemplateId: string;
  requestId: string;
  workflowRunId: string | null;
  compact?: boolean;
  title?: string;
}

const nodeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  start: Play,
  end: Flag,
  task: CheckSquare,
  validation: ShieldCheck,
  notification: Bell,
  condition: GitBranch,
  sub_process: Layers,
  fork: Split,
  join: Merge,
  status_change: RefreshCw,
  assignment: UserPlus,
};

const nodeColors: Record<string, { bg: string; border: string; text: string }> = {
  start: { bg: 'bg-green-100 dark:bg-green-900/30', border: 'border-green-500', text: 'text-green-600' },
  end: { bg: 'bg-red-100 dark:bg-red-900/30', border: 'border-red-500', text: 'text-red-600' },
  task: { bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-500', text: 'text-blue-600' },
  validation: { bg: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-amber-500', text: 'text-amber-600' },
  notification: { bg: 'bg-purple-100 dark:bg-purple-900/30', border: 'border-purple-500', text: 'text-purple-600' },
  condition: { bg: 'bg-cyan-100 dark:bg-cyan-900/30', border: 'border-cyan-500', text: 'text-cyan-600' },
  sub_process: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', border: 'border-indigo-500', text: 'text-indigo-600' },
  fork: { bg: 'bg-teal-100 dark:bg-teal-900/30', border: 'border-teal-500', text: 'text-teal-600' },
  join: { bg: 'bg-orange-100 dark:bg-orange-900/30', border: 'border-orange-500', text: 'text-orange-600' },
  status_change: { bg: 'bg-pink-100 dark:bg-pink-900/30', border: 'border-pink-500', text: 'text-pink-600' },
  assignment: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', border: 'border-emerald-500', text: 'text-emerald-600' },
};

async function fetchWorkflowRun(
  workflowRunId: string | null,
  requestId: string,
  workflowTemplateId: string
): Promise<WorkflowRunData | null> {
  const parseExecutionLog = (log: unknown): ExecutionLogEntry[] => {
    if (!Array.isArray(log)) return [];
    return log.filter((entry): entry is ExecutionLogEntry => 
      typeof entry === 'object' && 
      entry !== null && 
      'timestamp' in entry && 
      'node_id' in entry && 
      'action' in entry
    );
  };

  if (workflowRunId) {
    const { data } = await supabase
      .from('workflow_runs')
      .select('id, current_node_id, status, execution_log')
      .eq('id', workflowRunId)
      .maybeSingle();
    
    if (data) {
      return {
        id: data.id,
        current_node_id: data.current_node_id,
        status: data.status,
        execution_log: parseExecutionLog(data.execution_log),
      };
    }
  }
  
  // Fallback: search by trigger_entity_id and workflow_template_id
  const fallbackResult = await supabase
    .from('workflow_runs')
    .select('*')
    .limit(100);
  
  const filteredRuns = (fallbackResult.data || [])
    .filter((r: any) => 
      r.trigger_entity_id === requestId && 
      r.workflow_template_id === workflowTemplateId
    )
    .sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  
  if (filteredRuns.length > 0) {
    const run = filteredRuns[0];
    return {
      id: run.id,
      current_node_id: run.current_node_id,
      status: run.status,
      execution_log: parseExecutionLog(run.execution_log),
    };
  }
  
  return null;
}

export function SubProcessWorkflowView({ 
  subProcessTemplateId, 
  requestId, 
  workflowRunId,
  compact = false,
  title
}: SubProcessWorkflowViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);
  const [workflowRun, setWorkflowRun] = useState<WorkflowRunData | null>(null);
  const [workflowName, setWorkflowName] = useState<string>('');

  const fetchData = useCallback(async () => {
    try {
      // Get the workflow template for this sub-process
      const { data: workflowTemplate } = await supabase
        .from('workflow_templates')
        .select('id, name')
        .eq('sub_process_template_id', subProcessTemplateId)
        .eq('is_default', true)
        .maybeSingle();

      if (!workflowTemplate) {
        setIsLoading(false);
        return;
      }

      setWorkflowName(workflowTemplate.name);

      // Fetch nodes
      const { data: nodesData } = await supabase
        .from('workflow_nodes')
        .select('id, node_type, label, position_x, position_y, config')
        .eq('workflow_id', workflowTemplate.id)
        .order('position_x');

      // Fetch edges
      const { data: edgesData } = await supabase
        .from('workflow_edges')
        .select('id, source_node_id, target_node_id, source_handle, target_handle')
        .eq('workflow_id', workflowTemplate.id);

      if (nodesData) {
        setNodes(nodesData.map(n => ({
          ...n,
          config: (n.config || {}) as Record<string, unknown>,
        })));
      }
      if (edgesData) setEdges(edgesData);

      // Fetch workflow run
      const runData = await fetchWorkflowRun(workflowRunId, requestId, workflowTemplate.id);
      setWorkflowRun(runData);
    } catch (error) {
      console.error('Error fetching sub-process workflow:', error);
    } finally {
      setIsLoading(false);
    }
  }, [subProcessTemplateId, requestId, workflowRunId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute node statuses based on execution log
  const nodeStatuses = useMemo(() => {
    const statuses = new Map<string, 'completed' | 'current' | 'pending'>();
    
    if (!workflowRun) {
      nodes.forEach(n => statuses.set(n.id, 'pending'));
      return statuses;
    }

    const visitedNodes = new Set<string>();
    workflowRun.execution_log.forEach(entry => {
      visitedNodes.add(entry.node_id);
    });

    nodes.forEach(n => {
      if (n.id === workflowRun.current_node_id) {
        statuses.set(n.id, 'current');
      } else if (visitedNodes.has(n.id)) {
        statuses.set(n.id, 'completed');
      } else {
        statuses.set(n.id, 'pending');
      }
    });

    return statuses;
  }, [nodes, workflowRun]);

  // Sort nodes for linear display (BFS from start)
  const orderedNodes = useMemo(() => {
    if (nodes.length === 0) return [];
    
    const startNode = nodes.find(n => n.node_type === 'start');
    if (!startNode) return nodes;

    const ordered: WorkflowNode[] = [];
    const visited = new Set<string>();
    const queue = [startNode.id];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const node = nodes.find(n => n.id === nodeId);
      if (node) ordered.push(node);

      const outgoing = edges.filter(e => e.source_node_id === nodeId);
      outgoing.forEach(e => {
        if (!visited.has(e.target_node_id)) {
          queue.push(e.target_node_id);
        }
      });
    }

    nodes.forEach(n => {
      if (!visited.has(n.id)) ordered.push(n);
    });

    return ordered;
  }, [nodes, edges]);

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center", compact ? "h-16" : "h-32")}>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center text-muted-foreground",
        compact ? "h-16 flex-row gap-2" : "h-32"
      )}>
        <AlertCircle className={cn(compact ? "h-4 w-4" : "h-8 w-8")} />
        <p className={cn(compact && "text-sm")}>Workflow non configuré</p>
      </div>
    );
  }

  const runStatus = workflowRun?.status;
  const completedCount = Array.from(nodeStatuses.values()).filter(s => s === 'completed').length;
  const progressPercent = nodes.length > 0 ? Math.round((completedCount / nodes.length) * 100) : 0;

  // Compact view for global tab
  if (compact) {
    return (
      <div className="border rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">{title || workflowName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {completedCount}/{nodes.length}
            </span>
            {runStatus && (
              <Badge variant="outline" className="text-xs">
                {runStatus === 'completed' ? '✅' : runStatus === 'running' ? '⏳' : '⏸️'}
              </Badge>
            )}
          </div>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    );
  }

  // Full view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{workflowName || 'Workflow'}</h3>
          <p className="text-sm text-muted-foreground">
            {completedCount} / {nodes.length} étapes complétées
          </p>
        </div>
        <div className="flex items-center gap-2">
          {runStatus && (
            <Badge
              variant={
                runStatus === 'completed' ? 'default' :
                runStatus === 'running' ? 'secondary' :
                runStatus === 'paused' ? 'outline' : 'destructive'
              }
            >
              {runStatus === 'completed' && '✅ Terminé'}
              {runStatus === 'running' && '⏳ En cours'}
              {runStatus === 'paused' && '⏸️ En pause'}
              {runStatus === 'failed' && '❌ Échoué'}
              {runStatus === 'cancelled' && '🚫 Annulé'}
            </Badge>
          )}
          {!runStatus && (
            <Badge variant="outline">Non démarré</Badge>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progression</span>
          <span className="font-medium">{progressPercent}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Mini workflow visualization */}
      <div className="relative">
        <div className="flex flex-wrap gap-3 items-center">
          {orderedNodes.map((node, index) => {
            const Icon = nodeIcons[node.node_type] || CheckSquare;
            const colors = nodeColors[node.node_type] || nodeColors.task;
            const status = nodeStatuses.get(node.id) || 'pending';
            const isLast = index === orderedNodes.length - 1;

            return (
              <div key={node.id} className="flex items-center">
                <div
                  className={cn(
                    'relative flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all',
                    colors.bg,
                    colors.border,
                    status === 'current' && 'ring-2 ring-primary ring-offset-2 scale-105',
                    status === 'pending' && 'opacity-50'
                  )}
                >
                  <div className="absolute -top-2 -right-2">
                    {status === 'completed' && (
                      <div className="bg-success text-success-foreground rounded-full p-0.5">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                    {status === 'current' && (
                      <div className="bg-primary text-primary-foreground rounded-full p-0.5 animate-pulse">
                        <Clock className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                  
                  <Icon className={cn('h-4 w-4', colors.text)} />
                  <span className="text-xs font-medium max-w-[100px] truncate">
                    {node.label}
                  </span>
                </div>

                {!isLast && (
                  <div className={cn(
                    'mx-1 w-6 h-0.5',
                    status === 'completed' ? 'bg-success' : 'bg-muted-foreground/30'
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Execution log */}
      {workflowRun && workflowRun.execution_log.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Historique d'exécution</h4>
          <div className="space-y-1 max-h-[150px] overflow-y-auto">
            {workflowRun.execution_log.slice().reverse().slice(0, 10).map((entry, i) => {
              const node = nodes.find(n => n.id === entry.node_id);
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs p-2 rounded bg-muted/50"
                >
                  <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleString('fr-FR', { 
                      dateStyle: 'short', 
                      timeStyle: 'short' 
                    })}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {node?.label || entry.node_id.slice(0, 8)}
                  </Badge>
                  <span className="text-muted-foreground">
                    {entry.action === 'workflow_started' && '🚀 Démarré'}
                    {entry.action === 'task_node_reached' && '📋 Tâche atteinte'}
                    {entry.action === 'validation_created' && '✅ Validation créée'}
                    {entry.action === 'notification_sent' && '📧 Notification envoyée'}
                    {entry.action === 'workflow_completed' && '🎉 Terminé'}
                    {!['workflow_started', 'task_node_reached', 'validation_created', 'notification_sent', 'workflow_completed'].includes(entry.action) && entry.action}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}