import { useCallback, useRef, useState, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
  ReactFlowProvider,
  useReactFlow,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { workflowNodeTypes } from './WorkflowNodeTypes';
import { WorkflowNodePalette } from './WorkflowNodePalette';
import { WorkflowNodePropertiesPanel } from './WorkflowNodePropertiesPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Upload, Undo2, Redo2, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { 
  WorkflowWithDetails, 
  WorkflowNode, 
  WorkflowNodeType,
  WorkflowNodeConfig 
} from '@/types/workflow';
import type { TaskTemplate } from '@/types/template';
import type { TemplateCustomField } from '@/types/customField';

interface SubProcessOption {
  id: string;
  name: string;
}

interface UserOption {
  id: string;
  display_name: string | null;
}

interface GroupOption {
  id: string;
  name: string;
}

interface DepartmentOption {
  id: string;
  name: string;
}

interface WorkflowCanvasProps {
  workflow: WorkflowWithDetails | null;
  isLoading: boolean;
  isSaving: boolean;
  canManage: boolean;
  onAddNode: (
    nodeType: WorkflowNodeType,
    position: { x: number; y: number },
    label: string,
    config?: WorkflowNodeConfig
  ) => Promise<WorkflowNode | null>;
  onUpdateNode: (nodeId: string, updates: Partial<WorkflowNode>) => Promise<boolean>;
  onDeleteNode: (nodeId: string) => Promise<boolean>;
  onAddEdge: (
    sourceNodeId: string,
    targetNodeId: string,
    sourceHandle?: string,
    targetHandle?: string,
    branchLabel?: string
  ) => Promise<unknown>;
  onDeleteEdge: (edgeId: string) => Promise<boolean>;
  onPublish: () => Promise<boolean>;
  onSaveCanvasSettings: (settings: { zoom: number; x: number; y: number }) => Promise<void>;
  taskTemplates?: TaskTemplate[];
  subProcesses?: SubProcessOption[];
  customFields?: TemplateCustomField[];
  users?: UserOption[];
  groups?: GroupOption[];
  departments?: DepartmentOption[];
}

function WorkflowCanvasInner({
  workflow,
  isLoading,
  isSaving,
  canManage,
  onAddNode,
  onUpdateNode,
  onDeleteNode,
  onAddEdge,
  onDeleteEdge,
  onPublish,
  onSaveCanvasSettings,
  taskTemplates = [],
  subProcesses = [],
  customFields = [],
  users = [],
  groups = [],
  departments = [],
}: WorkflowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, zoomIn, zoomOut, fitView, getViewport } = useReactFlow();
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);

  // Convert workflow data to React Flow format
  const initialNodes: Node[] = useMemo(() => {
    if (!workflow) return [];
    return workflow.nodes.map(node => ({
      id: node.id,
      type: node.node_type,
      position: { x: node.position_x, y: node.position_y },
      data: {
        label: node.label,
        config: node.config,
        task_template_id: node.task_template_id,
      },
    }));
  }, [workflow]);

  const initialEdges: Edge[] = useMemo(() => {
    if (!workflow) return [];
    return workflow.edges.map(edge => ({
      id: edge.id,
      source: edge.source_node_id,
      target: edge.target_node_id,
      sourceHandle: edge.source_handle || undefined,
      targetHandle: edge.target_handle || undefined,
      label: edge.label || edge.branch_label || undefined,
      animated: edge.animated,
      style: { stroke: '#6366f1', strokeWidth: 2 },
    }));
  }, [workflow]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync with workflow changes
  useMemo(() => {
    if (workflow) {
      setNodes(workflow.nodes.map(node => ({
        id: node.id,
        type: node.node_type,
        position: { x: node.position_x, y: node.position_y },
        data: {
          label: node.label,
          config: node.config,
          task_template_id: node.task_template_id,
        },
      })));
      setEdges(workflow.edges.map(edge => ({
        id: edge.id,
        source: edge.source_node_id,
        target: edge.target_node_id,
        sourceHandle: edge.source_handle || undefined,
        targetHandle: edge.target_handle || undefined,
        label: edge.label || edge.branch_label || undefined,
        animated: edge.animated,
        style: { stroke: '#6366f1', strokeWidth: 2 },
      })));
    }
  }, [workflow, setNodes, setEdges]);

  // Handle drag from palette
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/workflow-node-type') as WorkflowNodeType;
      const label = event.dataTransfer.getData('application/workflow-node-label');
      const configStr = event.dataTransfer.getData('application/workflow-node-config');

      if (!type || !reactFlowWrapper.current) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      let overrideConfig: Partial<WorkflowNodeConfig> = {};
      if (configStr) {
        try {
          overrideConfig = JSON.parse(configStr) as Partial<WorkflowNodeConfig>;
        } catch {
          // ignore malformed config
        }
      }

      const mergedConfig = ({
        ...getDefaultConfig(type),
        ...overrideConfig,
      } as unknown) as WorkflowNodeConfig;

      await onAddNode(type, position, label, mergedConfig);
    },
    [screenToFlowPosition, onAddNode]
  );

  const onDragStart = (event: React.DragEvent, nodeType: WorkflowNodeType, label: string) => {
    event.dataTransfer.setData('application/workflow-node-type', nodeType);
    event.dataTransfer.setData('application/workflow-node-label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  // Handle connections
  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      
      await onAddEdge(
        connection.source,
        connection.target,
        connection.sourceHandle || undefined,
        connection.targetHandle || undefined
      );
    },
    [onAddEdge]
  );

  // Handle node position changes
  const handleNodesChange = useCallback(
    async (changes: NodeChange[]) => {
      onNodesChange(changes);
      
      // Save position changes
      for (const change of changes) {
        if (change.type === 'position' && change.position && !change.dragging) {
          await onUpdateNode(change.id, {
            position_x: change.position.x,
            position_y: change.position.y,
          });
        }
      }
    },
    [onNodesChange, onUpdateNode]
  );

  // Handle edge deletions
  const handleEdgesChange = useCallback(
    async (changes: EdgeChange[]) => {
      for (const change of changes) {
        if (change.type === 'remove') {
          await onDeleteEdge(change.id);
        }
      }
      onEdgesChange(changes);
    },
    [onEdgesChange, onDeleteEdge]
  );

  // Handle node selection
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const workflowNode = workflow?.nodes.find(n => n.id === node.id);
      setSelectedNode(workflowNode || null);
    },
    [workflow]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Handle edge click for deletion - MUST be before conditional returns
  const onEdgeClick = useCallback(
    async (event: React.MouseEvent, edge: Edge) => {
      if (!canManage) return;
      if (confirm('Supprimer cette liaison ?')) {
        await onDeleteEdge(edge.id);
      }
    },
    [canManage, onDeleteEdge]
  );

  // Handle publish
  const handlePublish = async () => {
    const viewport = getViewport();
    await onSaveCanvasSettings({ zoom: viewport.zoom, x: viewport.x, y: viewport.y });
    await onPublish();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Aucun workflow défini</p>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-2">
      {canManage && (
        <WorkflowNodePalette onDragStart={onDragStart} disabled={!canManage} />
      )}
      
      <div ref={reactFlowWrapper} className="flex-1 bg-slate-50 dark:bg-slate-900 rounded-lg overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={canManage ? handleNodesChange : undefined}
          onEdgesChange={canManage ? handleEdgesChange : undefined}
          onConnect={canManage ? onConnect : undefined}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          onDrop={canManage ? onDrop : undefined}
          onDragOver={canManage ? onDragOver : undefined}
          nodeTypes={workflowNodeTypes}
          defaultViewport={workflow.canvas_settings}
          fitView
          snapToGrid
          snapGrid={[15, 15]}
          deleteKeyCode={canManage ? ['Backspace', 'Delete'] : null}
          nodesConnectable={canManage}
          nodesDraggable={canManage}
          elementsSelectable={true}
          className="workflow-canvas"
        >
          <Background gap={15} size={1} />
          <Controls showZoom={false} showFitView={false} showInteractive={false} />
          <MiniMap 
            nodeColor={(node) => {
              switch (node.type) {
                case 'start': return '#22c55e';
                case 'end': return '#ef4444';
                case 'task': return '#3b82f6';
                case 'validation': return '#f59e0b';
                case 'notification': return '#a855f7';
                case 'condition': return '#06b6d4';
                default: return '#6b7280';
              }
            }}
            className="!bg-white dark:!bg-slate-800"
          />
          
          {/* Top toolbar */}
          <Panel position="top-right" className="flex items-center gap-2">
            <Badge 
              variant={workflow.status === 'active' ? 'default' : 'secondary'}
              className="capitalize"
            >
              {workflow.status === 'draft' && '📝 Brouillon'}
              {workflow.status === 'active' && '✅ Actif'}
              {workflow.status === 'inactive' && '⏸️ Inactif'}
              {workflow.status === 'archived' && '🗄️ Archivé'}
            </Badge>
            <span className="text-xs text-muted-foreground">v{workflow.version}</span>
          </Panel>

          {/* Bottom toolbar */}
          <Panel position="bottom-center" className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg p-2">
            <Button variant="ghost" size="icon" onClick={() => zoomOut()}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => zoomIn()}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => fitView()}>
              <Maximize2 className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-1" />
            {canManage && (
              <>
                <Button variant="ghost" size="icon" disabled>
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" disabled>
                  <Redo2 className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button 
                  onClick={handlePublish} 
                  disabled={isSaving || workflow.status === 'active'}
                  className="gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Publier
                </Button>
              </>
            )}
          </Panel>
        </ReactFlow>
      </div>

      <WorkflowNodePropertiesPanel
        node={selectedNode}
        onUpdate={onUpdateNode}
        onDelete={onDeleteNode}
        onClose={() => setSelectedNode(null)}
        disabled={!canManage}
        taskTemplates={taskTemplates}
        subProcesses={subProcesses}
        customFields={customFields}
        users={users}
        groups={groups}
        departments={departments}
      />
    </div>
  );
}

// Wrap with provider
export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

// Helper to get default config for each node type
function getDefaultConfig(type: WorkflowNodeType): WorkflowNodeConfig {
  switch (type) {
    case 'start':
      return { trigger: 'on_create' };
    case 'end':
      return { final_status: 'completed' };
    case 'task':
      return { duration_days: 1, responsible_type: 'assignee', requires_validation: false };
    case 'sub_process':
      return { execute_all_tasks: true, branch_on_selection: false };
    case 'validation':
      return { 
        approver_type: 'requester_manager', 
        is_mandatory: true, 
        approval_mode: 'single',
        trigger_mode: 'auto'  // Default to auto-trigger for backward compatibility
      };
    case 'notification':
      return { 
        channels: ['in_app'], 
        recipient_type: 'requester',
        subject_template: 'Notification: {processus}',
        body_template: 'Une action est requise concernant {tache}.'
      };
    case 'condition':
      return { 
        field: 'priority', 
        operator: 'equals', 
        branches: { true_label: 'Oui', false_label: 'Non' } 
      };
    case 'fork':
      return {
        branch_mode: 'static',
        branches: [
          { id: 'branch_1', name: 'Branche 1' },
          { id: 'branch_2', name: 'Branche 2' }
        ]
      };
    case 'join':
      return {
        join_type: 'and',  // Wait for all branches by default
        on_timeout_action: 'notify'
      };
    case 'status_change':
      return {
        new_status: 'validated',
        trigger_event: 'validation_approved'
      };
    case 'assignment':
      return {
        assignment_type: 'user',
        auto_start: true
      };
    default:
      return {};
  }
}
