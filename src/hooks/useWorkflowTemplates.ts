import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';
import { createProcessWorkflow, createSubProcessWorkflow } from '@/hooks/useAutoWorkflowGeneration';
import type { 
  WorkflowTemplate, 
  WorkflowNode, 
  WorkflowEdge, 
  WorkflowWithDetails,
  WorkflowNodeType,
  WorkflowNodeConfig,
  WorkflowStatus
} from '@/types/workflow';

interface UseWorkflowTemplatesParams {
  processTemplateId?: string | null;
  subProcessTemplateId?: string | null;
}

export function useWorkflowTemplates({ 
  processTemplateId, 
  subProcessTemplateId 
}: UseWorkflowTemplatesParams) {
  const { user } = useAuth();
  const [workflow, setWorkflow] = useState<WorkflowWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Prevent infinite re-generation loops
  const didAttemptAutoCreateRef = useRef(false);

  const fetchWorkflow = useCallback(async () => {
    if (!processTemplateId && !subProcessTemplateId) return;

    setIsLoading(true);
    try {
      // First, get the workflow template
      let query = supabase
        .from('workflow_templates')
        .select('*')
        .eq('is_default', true);
      
      if (processTemplateId) {
        query = query.eq('process_template_id', processTemplateId);
      } else if (subProcessTemplateId) {
        query = query.eq('sub_process_template_id', subProcessTemplateId);
      }

      const { data: workflowData, error: workflowError } = await query.maybeSingle();

      if (workflowError) throw workflowError;

      if (!workflowData) {
        // Auto-create a minimal workflow when missing (required by business rules)
        // Only if authenticated and we haven't already attempted during this mount.
        if (user && !didAttemptAutoCreateRef.current) {
          didAttemptAutoCreateRef.current = true;

          try {
            if (subProcessTemplateId) {
              const [{ data: sp }, { data: tasks }] = await Promise.all([
                supabase
                  .from('sub_process_templates')
                  .select('id, name, target_manager_id, target_department_id')
                  .eq('id', subProcessTemplateId)
                  .maybeSingle(),
                supabase
                  .from('task_templates')
                  .select('id, title, default_duration_days')
                  .eq('sub_process_template_id', subProcessTemplateId)
                  .order('order_index'),
              ]);

              if (sp) {
                await createSubProcessWorkflow(
                  sp.id,
                  sp.name,
                  user.id,
                  (tasks || []) as any,
                  {
                    target_manager_id: (sp as any).target_manager_id,
                    target_department_id: (sp as any).target_department_id,
                  }
                );
              }
            } else if (processTemplateId) {
              const [{ data: p }, { data: subProcesses }] = await Promise.all([
                supabase
                  .from('process_templates')
                  .select('id, name')
                  .eq('id', processTemplateId)
                  .maybeSingle(),
                supabase
                  .from('sub_process_templates')
                  .select('id, name')
                  .eq('process_template_id', processTemplateId)
                  .order('order_index'),
              ]);

              if (p) {
                await createProcessWorkflow(
                  (p as any).id,
                  (p as any).name,
                  user.id,
                  (subProcesses || []) as any
                );
              }
            }
          } catch (e) {
            console.error('Auto-create workflow failed:', e);
          }

          // Re-run the fetch once after auto-create
          const { data: createdWorkflow, error: createdWorkflowError } = await query.maybeSingle();
          if (createdWorkflowError) throw createdWorkflowError;
          if (!createdWorkflow) {
            setWorkflow(null);
            return;
          }

          // Fetch nodes and edges for created workflow
          const [{ data: nodesData }, { data: edgesData }] = await Promise.all([
            supabase
              .from('workflow_nodes')
              .select('*')
              .eq('workflow_id', createdWorkflow.id)
              .order('created_at'),
            supabase
              .from('workflow_edges')
              .select('*')
              .eq('workflow_id', createdWorkflow.id),
          ]);

          setWorkflow({
            ...createdWorkflow,
            canvas_settings: createdWorkflow.canvas_settings as WorkflowTemplate['canvas_settings'],
            status: createdWorkflow.status as WorkflowStatus,
            nodes: (nodesData || []).map(n => ({
              ...n,
              node_type: n.node_type as WorkflowNodeType,
              config: n.config as WorkflowNodeConfig,
              style: n.style as Record<string, unknown>,
            })),
            edges: (edgesData || []).map(e => ({
              ...e,
              condition_expression: e.condition_expression as Record<string, unknown> | null,
              style: e.style as Record<string, unknown>,
            })),
          });

          return;
        }

        setWorkflow(null);
        return;
      }

      // Fetch nodes and edges
      const [{ data: nodesData }, { data: edgesData }] = await Promise.all([
        supabase
          .from('workflow_nodes')
          .select('*')
          .eq('workflow_id', workflowData.id)
          .order('created_at'),
        supabase
          .from('workflow_edges')
          .select('*')
          .eq('workflow_id', workflowData.id)
      ]);

      setWorkflow({
        ...workflowData,
        canvas_settings: workflowData.canvas_settings as WorkflowTemplate['canvas_settings'],
        status: workflowData.status as WorkflowStatus,
        nodes: (nodesData || []).map(n => ({
          ...n,
          node_type: n.node_type as WorkflowNodeType,
          config: n.config as WorkflowNodeConfig,
          style: n.style as Record<string, unknown>,
        })),
        edges: (edgesData || []).map(e => ({
          ...e,
          condition_expression: e.condition_expression as Record<string, unknown> | null,
          style: e.style as Record<string, unknown>,
        })),
      });
    } catch (error) {
      console.error('Error fetching workflow:', error);
      toast.error('Erreur lors du chargement du workflow');
    } finally {
      setIsLoading(false);
    }
  }, [processTemplateId, subProcessTemplateId, user]);

  useEffect(() => {
    // Reset auto-create attempt when switching templates
    didAttemptAutoCreateRef.current = false;
    fetchWorkflow();
  }, [fetchWorkflow]);

  const createWorkflow = async (name: string, description?: string) => {
    if (!user || (!processTemplateId && !subProcessTemplateId)) return null;

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('workflow_templates')
        .insert({
          name,
          description: description || null,
          created_by: user.id,
          is_default: true,
          status: 'active' as const,
          process_template_id: processTemplateId || null,
          sub_process_template_id: subProcessTemplateId || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Create default Start and End nodes
      const { data: nodesData, error: nodesError } = await supabase
        .from('workflow_nodes')
        .insert([
          {
            workflow_id: data.id,
            node_type: 'start' as const,
            label: 'Début',
            position_x: 100,
            position_y: 200,
            config: { trigger: 'on_create' },
          },
          {
            workflow_id: data.id,
            node_type: 'end' as const,
            label: 'Fin',
            position_x: 600,
            position_y: 200,
            config: { final_status: 'completed' },
          },
        ])
        .select();

      if (nodesError) throw nodesError;

      const newWorkflow: WorkflowWithDetails = {
        ...data,
        canvas_settings: data.canvas_settings as WorkflowTemplate['canvas_settings'],
        status: data.status as WorkflowStatus,
        nodes: (nodesData || []).map(n => ({
          ...n,
          node_type: n.node_type as WorkflowNodeType,
          config: n.config as WorkflowNodeConfig,
          style: n.style as Record<string, unknown>,
        })),
        edges: [],
      };

      setWorkflow(newWorkflow);
      toast.success('Workflow créé avec succès');
      return newWorkflow;
    } catch (error) {
      console.error('Error creating workflow:', error);
      toast.error('Erreur lors de la création du workflow');
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const updateWorkflow = async (updates: Partial<WorkflowTemplate>) => {
    if (!workflow) return false;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('workflow_templates')
        .update(updates)
        .eq('id', workflow.id);

      if (error) throw error;

      setWorkflow(prev => prev ? { ...prev, ...updates } : null);
      return true;
    } catch (error) {
      console.error('Error updating workflow:', error);
      toast.error('Erreur lors de la mise à jour');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const addNode = async (
    nodeType: WorkflowNodeType,
    position: { x: number; y: number },
    label: string,
    config: WorkflowNodeConfig = {}
  ) => {
    if (!workflow) return null;

    try {
      const insertData = {
        workflow_id: workflow.id,
        node_type: nodeType as
          | 'start'
          | 'end'
          | 'task'
          | 'validation'
          | 'notification'
          | 'condition'
          | 'sub_process'
          | 'fork'
          | 'join'
          | 'status_change'
          | 'assignment',
        label,
        position_x: position.x,
        position_y: position.y,
        config: config as Json,
      };

      const { data, error } = await supabase
        .from('workflow_nodes')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;

      const newNode: WorkflowNode = {
        ...data,
        node_type: data.node_type as WorkflowNodeType,
        config: data.config as WorkflowNodeConfig,
        style: data.style as Record<string, unknown>,
      };

      setWorkflow(prev => prev ? {
        ...prev,
        nodes: [...prev.nodes, newNode],
      } : null);

      return newNode;
    } catch (error) {
      console.error('Error adding node:', error);
      toast.error('Erreur lors de l\'ajout du bloc');
      return null;
    }
  };

  const updateNode = async (nodeId: string, updates: Partial<WorkflowNode>) => {
    if (!workflow) return false;

    try {
      const updateData: Record<string, unknown> = {};
      if (updates.label !== undefined) updateData.label = updates.label;
      if (updates.position_x !== undefined) updateData.position_x = updates.position_x;
      if (updates.position_y !== undefined) updateData.position_y = updates.position_y;
      if (updates.config !== undefined) updateData.config = updates.config;
      if (updates.task_template_id !== undefined) updateData.task_template_id = updates.task_template_id;
      if (updates.width !== undefined) updateData.width = updates.width;
      if (updates.height !== undefined) updateData.height = updates.height;
      if (updates.style !== undefined) updateData.style = updates.style;

      const { error } = await supabase
        .from('workflow_nodes')
        .update(updateData)
        .eq('id', nodeId);

      if (error) throw error;

      setWorkflow(prev => prev ? {
        ...prev,
        nodes: prev.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n),
      } : null);

      return true;
    } catch (error) {
      console.error('Error updating node:', error);
      return false;
    }
  };

  const deleteNode = async (nodeId: string) => {
    if (!workflow) return false;

    try {
      const { error } = await supabase
        .from('workflow_nodes')
        .delete()
        .eq('id', nodeId);

      if (error) throw error;

      setWorkflow(prev => prev ? {
        ...prev,
        nodes: prev.nodes.filter(n => n.id !== nodeId),
        edges: prev.edges.filter(e => e.source_node_id !== nodeId && e.target_node_id !== nodeId),
      } : null);

      return true;
    } catch (error) {
      console.error('Error deleting node:', error);
      toast.error('Erreur lors de la suppression');
      return false;
    }
  };

  const addEdge = async (
    sourceNodeId: string,
    targetNodeId: string,
    sourceHandle?: string,
    targetHandle?: string,
    branchLabel?: string
  ) => {
    if (!workflow) return null;

    try {
      const { data, error } = await supabase
        .from('workflow_edges')
        .insert({
          workflow_id: workflow.id,
          source_node_id: sourceNodeId,
          target_node_id: targetNodeId,
          source_handle: sourceHandle,
          target_handle: targetHandle,
          branch_label: branchLabel,
          animated: true,
        })
        .select()
        .single();

      if (error) throw error;

      const newEdge: WorkflowEdge = {
        ...data,
        condition_expression: data.condition_expression as Record<string, unknown> | null,
        style: data.style as Record<string, unknown>,
      };

      setWorkflow(prev => prev ? {
        ...prev,
        edges: [...prev.edges, newEdge],
      } : null);

      return newEdge;
    } catch (error) {
      console.error('Error adding edge:', error);
      return null;
    }
  };

  const deleteEdge = async (edgeId: string) => {
    if (!workflow) return false;

    try {
      const { error } = await supabase
        .from('workflow_edges')
        .delete()
        .eq('id', edgeId);

      if (error) throw error;

      setWorkflow(prev => prev ? {
        ...prev,
        edges: prev.edges.filter(e => e.id !== edgeId),
      } : null);

      return true;
    } catch (error) {
      console.error('Error deleting edge:', error);
      return false;
    }
  };

  const publishWorkflow = async () => {
    if (!workflow) return false;

    setIsSaving(true);
    try {
      // Validate workflow has start and end
      const hasStart = workflow.nodes.some(n => n.node_type === 'start');
      const hasEnd = workflow.nodes.some(n => n.node_type === 'end');

      if (!hasStart || !hasEnd) {
        toast.error('Le workflow doit avoir un bloc Début et un bloc Fin');
        return false;
      }

      // Check all nodes are connected
      const connectedNodes = new Set<string>();
      const startNode = workflow.nodes.find(n => n.node_type === 'start');
      if (startNode) {
        const queue = [startNode.id];
        while (queue.length > 0) {
          const nodeId = queue.shift()!;
          if (connectedNodes.has(nodeId)) continue;
          connectedNodes.add(nodeId);
          
          const outgoingEdges = workflow.edges.filter(e => e.source_node_id === nodeId);
          outgoingEdges.forEach(e => queue.push(e.target_node_id));
        }
      }

      if (connectedNodes.size !== workflow.nodes.length) {
        toast.error('Tous les blocs doivent être connectés');
        return false;
      }

      // Create version snapshot
      const versionData = {
        workflow_id: workflow.id,
        version: workflow.version,
        nodes_snapshot: workflow.nodes as unknown as Json,
        edges_snapshot: workflow.edges as unknown as Json,
        settings_snapshot: workflow.canvas_settings as unknown as Json,
        published_by: user?.id,
      };

      const { error: versionError } = await supabase
        .from('workflow_template_versions')
        .insert([versionData]);

      if (versionError) throw versionError;

      // Update workflow status
      const { error } = await supabase
        .from('workflow_templates')
        .update({
          status: 'active',
          version: workflow.version + 1,
          published_at: new Date().toISOString(),
        })
        .eq('id', workflow.id);

      if (error) throw error;

      setWorkflow(prev => prev ? {
        ...prev,
        status: 'active',
        version: prev.version + 1,
        published_at: new Date().toISOString(),
      } : null);

      toast.success('Workflow publié avec succès');
      return true;
    } catch (error) {
      console.error('Error publishing workflow:', error);
      toast.error('Erreur lors de la publication');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const saveCanvasSettings = async (settings: WorkflowTemplate['canvas_settings']) => {
    if (!workflow) return;

    await supabase
      .from('workflow_templates')
      .update({ canvas_settings: settings })
      .eq('id', workflow.id);

    setWorkflow(prev => prev ? { ...prev, canvas_settings: settings } : null);
  };

  return {
    workflow,
    isLoading,
    isSaving,
    createWorkflow,
    updateWorkflow,
    addNode,
    updateNode,
    deleteNode,
    addEdge,
    deleteEdge,
    publishWorkflow,
    saveCanvasSettings,
    refetch: fetchWorkflow,
  };
}
