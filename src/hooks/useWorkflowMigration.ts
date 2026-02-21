import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

interface MigrationResult {
  processId: string;
  processName: string;
  workflowCreated: boolean;
  nodesCreated: number;
  error?: string;
}

export function useWorkflowMigration() {
  const { user } = useAuth();
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResults, setMigrationResults] = useState<MigrationResult[]>([]);

  // Migrate a single process template to workflow
  const migrateProcessTemplate = useCallback(async (
    processId: string
  ): Promise<MigrationResult | null> => {
    if (!user) return null;

    try {
      // Check if workflow already exists
      const { data: existingWorkflow } = await supabase
        .from('workflow_templates')
        .select('id')
        .eq('process_template_id', processId)
        .eq('is_default', true)
        .maybeSingle();

      if (existingWorkflow) {
        return {
          processId,
          processName: '',
          workflowCreated: false,
          nodesCreated: 0,
          error: 'Workflow déjà existant'
        };
      }

      // Get process template with sub-processes and tasks
      const { data: process, error: processError } = await supabase
        .from('process_templates')
        .select(`
          id,
          name,
          target_department_id,
          target_company_id
        `)
        .eq('id', processId)
        .single();

      if (processError || !process) {
        return {
          processId,
          processName: '',
          workflowCreated: false,
          nodesCreated: 0,
          error: 'Processus non trouvé'
        };
      }

      // Get sub-processes with their routing info
      const { data: subProcesses } = await supabase
        .from('sub_process_templates')
        .select(`
          id,
          name,
          order_index,
          target_department_id,
          target_manager_id,
          target_group_id,
          is_mandatory
        `)
        .eq('process_template_id', processId)
        .order('order_index');

      // Get direct tasks
      const { data: directTasks } = await supabase
        .from('task_templates')
        .select('id, title, order_index')
        .eq('process_template_id', processId)
        .is('sub_process_template_id', null)
        .order('order_index');

      // Create the workflow template
      const { data: workflow, error: workflowError } = await supabase
        .from('workflow_templates')
        .insert([{
          process_template_id: processId,
          name: `Workflow - ${process.name}`,
          description: `Workflow généré automatiquement pour le processus "${process.name}"`,
          created_by: user.id,
          is_default: true,
          status: 'active' as const,
        }])
        .select()
        .single();

      if (workflowError || !workflow) {
        return {
          processId,
          processName: process.name,
          workflowCreated: false,
          nodesCreated: 0,
          error: workflowError?.message || 'Erreur création workflow'
        };
      }

      // Build nodes array
      const nodes: Array<{
        workflow_id: string;
        node_type: 'start' | 'end' | 'task' | 'validation' | 'notification' | 'condition';
        label: string;
        position_x: number;
        position_y: number;
        config: Json;
        task_template_id?: string;
      }> = [];

      const edges: Array<{
        workflow_id: string;
        source_node_id: string;
        target_node_id: string;
        animated: boolean;
      }> = [];

      // Start node
      const startNodeId = crypto.randomUUID();
      nodes.push({
        workflow_id: workflow.id,
        node_type: 'start',
        label: 'Début',
        position_x: 100,
        position_y: 300,
        config: { trigger: 'on_create' } as Json,
      });

      // Track previous node for chaining
      let previousNodeIndex = 0;
      let yPosition = 300;
      let xPosition = 300;

      // Add notification node after start
      const notificationAfterStartIndex = nodes.length;
      nodes.push({
        workflow_id: workflow.id,
        node_type: 'notification',
        label: 'Notification création',
        position_x: xPosition,
        position_y: yPosition,
        config: {
          channels: ['in_app'],
          recipient_type: 'requester',
          subject_template: 'Demande créée',
          body_template: 'Votre demande a été créée et est en cours de traitement.',
        } as Json,
      });

      xPosition += 250;

      // Add task nodes for each sub-process or direct task
      const allTasks = [
        ...(subProcesses || []).map(sp => ({
          type: 'subprocess' as const,
          id: sp.id,
          name: sp.name,
          order: sp.order_index,
          hasManager: !!sp.target_manager_id,
          hasDepartment: !!sp.target_department_id,
        })),
        ...(directTasks || []).map(t => ({
          type: 'task' as const,
          id: t.id,
          name: t.title,
          order: t.order_index,
          hasManager: false,
          hasDepartment: false,
        }))
      ].sort((a, b) => a.order - b.order);

      for (const task of allTasks) {
        // Add task node
        const taskNodeIndex = nodes.length;
        nodes.push({
          workflow_id: workflow.id,
          node_type: 'task',
          label: task.name,
          position_x: xPosition,
          position_y: yPosition,
          config: {
            task_title: task.name,
            duration_days: 5,
          } as Json,
          task_template_id: task.type === 'task' ? task.id : undefined,
        });

        xPosition += 250;

        // If sub-process has a manager target, add validation node
        if (task.hasManager) {
          nodes.push({
            workflow_id: workflow.id,
            node_type: 'validation',
            label: `Validation - ${task.name}`,
            position_x: xPosition,
            position_y: yPosition,
            config: {
              approver_type: 'target_manager',
              is_mandatory: true,
              approval_mode: 'single',
            } as Json,
          });
          xPosition += 250;
        }
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
        return {
          processId,
          processName: process.name,
          workflowCreated: true,
          nodesCreated: 0,
          error: nodesError?.message || 'Erreur création nœuds'
        };
      }

      // Create edges to connect nodes sequentially
      for (let i = 0; i < insertedNodes.length - 1; i++) {
        edges.push({
          workflow_id: workflow.id,
          source_node_id: insertedNodes[i].id,
          target_node_id: insertedNodes[i + 1].id,
          animated: true,
        });
      }

      // Insert edges
      if (edges.length > 0) {
        await supabase.from('workflow_edges').insert(edges);
      }

      return {
        processId,
        processName: process.name,
        workflowCreated: true,
        nodesCreated: insertedNodes.length,
      };
    } catch (error) {
      console.error('Migration error:', error);
      return {
        processId,
        processName: '',
        workflowCreated: false,
        nodesCreated: 0,
        error: String(error)
      };
    }
  }, [user]);

  // Migrate all process templates
  const migrateAllProcesses = useCallback(async (): Promise<MigrationResult[]> => {
    if (!user) return [];

    setIsMigrating(true);
    setMigrationResults([]);

    try {
      // Get all process templates
      const { data: processes, error } = await supabase
        .from('process_templates')
        .select('id, name')
        .order('name');

      if (error || !processes) {
        toast.error('Erreur lors de la récupération des processus');
        return [];
      }

      const results: MigrationResult[] = [];

      for (const process of processes) {
        const result = await migrateProcessTemplate(process.id);
        if (result) {
          results.push({ ...result, processName: process.name });
        }
      }

      setMigrationResults(results);

      const successCount = results.filter(r => r.workflowCreated).length;
      const skipCount = results.filter(r => r.error === 'Workflow déjà existant').length;
      const errorCount = results.filter(r => r.error && r.error !== 'Workflow déjà existant').length;

      if (successCount > 0) {
        toast.success(`${successCount} workflow(s) créé(s)`);
      }
      if (skipCount > 0) {
        toast.info(`${skipCount} processus déjà migrés`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} erreur(s) de migration`);
      }

      return results;
    } catch (error) {
      console.error('Migration error:', error);
      toast.error('Erreur lors de la migration');
      return [];
    } finally {
      setIsMigrating(false);
    }
  }, [user, migrateProcessTemplate]);

  return {
    isMigrating,
    migrationResults,
    migrateProcessTemplate,
    migrateAllProcesses,
  };
}
