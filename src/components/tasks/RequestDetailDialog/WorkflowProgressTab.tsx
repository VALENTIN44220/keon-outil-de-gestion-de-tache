import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Play, Flag, CheckSquare, ShieldCheck, Bell, GitBranch, Layers, Split, Merge, RefreshCw, UserPlus, Check, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/task';

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

interface WorkflowRun {
  id: string;
  current_node_id: string | null;
  status: string;
  execution_log: Array<{
    timestamp: string;
    node_id: string;
    action: string;
  }>;
}

interface WorkflowProgressTabProps {
  task: Task;
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

export function WorkflowProgressTab({ task }: WorkflowProgressTabProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);
  const [workflowRun, setWorkflowRun] = useState<WorkflowRun | null>(null);
  const [workflowName, setWorkflowName] = useState<string>('');

  const fetchWorkflowData = useCallback(async () => {
    if (!task.source_process_template_id) {
      setIsLoading(false);
      return;
    }

    try {
      // Get the active workflow template for this process
      const { data: workflowTemplate } = await supabase
        .from('workflow_templates')
        .select('id, name')
        .eq('process_template_id', task.source_process_template_id)
        .eq('is_default', true)
        .maybeSingle();

      if (!workflowTemplate) {
        setIsLoading(false);
        return;
      }

      setWorkflowName(workflowTemplate.name);

      // Fetch nodes and edges
      const [{ data: nodesData }, { data: edgesData }] = await Promise.all([
        supabase
          .from('workflow_nodes')
          .select('id, node_type, label, position_x, position_y, config')
          .eq('workflow_id', workflowTemplate.id)
          .order('position_x'),
        supabase
          .from('workflow_edges')
          .select('id, source_node_id, target_node_id, source_handle, target_handle')
          .eq('workflow_id', workflowTemplate.id),
      ]);

      if (nodesData) {
        setNodes(nodesData.map(n => ({
          ...n,
          config: (n.config || {}) as Record<string, unknown>,
        })));
      }
      if (edgesData) setEdges(edgesData);

      // Fetch workflow run for this request
      const { data: runData } = await supabase
        .from('workflow_runs')
        .select('id, current_node_id, status, execution_log')
        .eq('trigger_entity_id', task.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (runData) {
        setWorkflowRun({
          ...runData,
          execution_log: (runData.execution_log || []) as WorkflowRun['execution_log'],
        });
      }
    } catch (error) {
      console.error('Error fetching workflow data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [task.id, task.source_process_template_id]);

  useEffect(() => {
    fetchWorkflowData();
  }, [fetchWorkflowData]);

  // Compute node statuses based on execution log
  const nodeStatuses = useMemo(() => {
    const statuses = new Map<string, 'completed' | 'current' | 'pending'>();
    
    if (!workflowRun) {
      // No run yet - all pending
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

      // Find outgoing edges and add targets to queue
      const outgoing = edges.filter(e => e.source_node_id === nodeId);
      outgoing.forEach(e => {
        if (!visited.has(e.target_node_id)) {
          queue.push(e.target_node_id);
        }
      });
    }

    // Add any unvisited nodes at the end
    nodes.forEach(n => {
      if (!visited.has(n.id)) ordered.push(n);
    });

    return ordered;
  }, [nodes, edges]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!task.source_process_template_id) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
        <p>Aucun processus associé à cette demande</p>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
        <p>Workflow non configuré pour ce processus</p>
      </div>
    );
  }

  const runStatus = workflowRun?.status;
  const completedCount = Array.from(nodeStatuses.values()).filter(s => s === 'completed').length;
  const progressPercent = nodes.length > 0 ? Math.round((completedCount / nodes.length) * 100) : 0;

  return (
    <ScrollArea className="h-[400px]">
      <div className="p-4 space-y-6">
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
                    {/* Status indicator */}
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

                  {/* Connector arrow */}
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
    </ScrollArea>
  );
}
