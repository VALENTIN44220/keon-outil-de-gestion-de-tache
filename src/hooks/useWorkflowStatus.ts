import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface WorkflowStatusInfo {
  hasWorkflow: boolean;
  status: 'draft' | 'active' | 'inactive' | 'archived' | null;
  taskCount: number;
  hasValidation: boolean;
  nodeCount: number;
}

export function useSubProcessWorkflowStatuses(subProcessIds: string[]) {
  return useQuery({
    queryKey: ['workflow-statuses', 'sub-processes', subProcessIds],
    queryFn: async (): Promise<Record<string, WorkflowStatusInfo>> => {
      if (subProcessIds.length === 0) return {};

      // Fetch workflows for all sub-processes
      const { data: workflows, error } = await supabase
        .from('workflow_templates')
        .select(`
          id,
          sub_process_template_id,
          status,
          workflow_nodes (
            id,
            node_type
          )
        `)
        .in('sub_process_template_id', subProcessIds)
        .eq('is_default', true);

      if (error) {
        console.error('Error fetching workflow statuses:', error);
        return {};
      }

      const statusMap: Record<string, WorkflowStatusInfo> = {};

      // Initialize all sub-processes as having no workflow
      for (const id of subProcessIds) {
        statusMap[id] = {
          hasWorkflow: false,
          status: null,
          taskCount: 0,
          hasValidation: false,
          nodeCount: 0,
        };
      }

      // Update with actual workflow data
      for (const workflow of workflows || []) {
        if (workflow.sub_process_template_id) {
          const nodes = workflow.workflow_nodes || [];
          const taskNodes = nodes.filter((n: any) => n.node_type === 'task');
          const validationNodes = nodes.filter((n: any) => n.node_type === 'validation');

          statusMap[workflow.sub_process_template_id] = {
            hasWorkflow: true,
            status: workflow.status as WorkflowStatusInfo['status'],
            taskCount: taskNodes.length,
            hasValidation: validationNodes.length > 0,
            nodeCount: nodes.length,
          };
        }
      }

      return statusMap;
    },
    enabled: subProcessIds.length > 0,
    staleTime: 30000,
  });
}

export function useProcessWorkflowStatuses(processIds: string[]) {
  return useQuery({
    queryKey: ['workflow-statuses', 'processes', processIds],
    queryFn: async (): Promise<Record<string, WorkflowStatusInfo>> => {
      if (processIds.length === 0) return {};

      const { data: workflows, error } = await supabase
        .from('workflow_templates')
        .select(`
          id,
          process_template_id,
          status,
          workflow_nodes (
            id,
            node_type
          )
        `)
        .in('process_template_id', processIds)
        .eq('is_default', true);

      if (error) {
        console.error('Error fetching workflow statuses:', error);
        return {};
      }

      const statusMap: Record<string, WorkflowStatusInfo> = {};

      for (const id of processIds) {
        statusMap[id] = {
          hasWorkflow: false,
          status: null,
          taskCount: 0,
          hasValidation: false,
          nodeCount: 0,
        };
      }

      for (const workflow of workflows || []) {
        if (workflow.process_template_id) {
          const nodes = workflow.workflow_nodes || [];
          const subProcessNodes = nodes.filter((n: any) => n.node_type === 'sub_process');
          const validationNodes = nodes.filter((n: any) => n.node_type === 'validation');

          statusMap[workflow.process_template_id] = {
            hasWorkflow: true,
            status: workflow.status as WorkflowStatusInfo['status'],
            taskCount: subProcessNodes.length,
            hasValidation: validationNodes.length > 0,
            nodeCount: nodes.length,
          };
        }
      }

      return statusMap;
    },
    enabled: processIds.length > 0,
    staleTime: 30000,
  });
}
