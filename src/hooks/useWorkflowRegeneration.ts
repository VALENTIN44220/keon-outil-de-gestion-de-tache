import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  createSubProcessWorkflow,
  createProcessWorkflow,
} from '@/hooks/useAutoWorkflowGeneration';
import { toast } from 'sonner';
import {
  isInterventionBEProcess,
  applyInterventionBEPresetToSubProcesses,
  getSubProcessIdsForProcess,
} from '@/utils/interventionBEPreset';

export interface RegenerationResult {
  id: string;
  name: string;
  type: 'process' | 'subprocess';
  status: 'created' | 'updated' | 'skipped' | 'error';
  message?: string;
  hasExistingWorkflow: boolean;
  taskCount?: number;
}

export interface RegenerationSummary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  results: RegenerationResult[];
}

interface SelectionOptions {
  processIds?: string[];
  subProcessIds?: string[];
  forceRegenerate?: boolean;
  dryRun?: boolean;
}

export function useWorkflowRegeneration() {
  const { user } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const analyzeWorkflows = useCallback(async (): Promise<{
    processes: Array<{ id: string; name: string; hasWorkflow: boolean; subProcessCount: number }>;
    subProcesses: Array<{ id: string; name: string; hasWorkflow: boolean; taskCount: number; processName: string | null }>;
  }> => {
    // Fetch all processes with sub-process count
    const { data: processes } = await supabase
      .from('process_templates')
      .select(`
        id,
        name,
        sub_process_templates (id)
      `)
      .order('name');

    // Fetch all sub-processes with task count
    const { data: subProcesses } = await supabase
      .from('sub_process_templates')
      .select(`
        id,
        name,
        process_template_id,
        process_templates (name),
        task_templates (id)
      `)
      .order('name');

    // Fetch existing workflows
    const { data: existingWorkflows } = await supabase
      .from('workflow_templates')
      .select('process_template_id, sub_process_template_id')
      .eq('is_default', true);

    const processWorkflowIds = new Set(
      existingWorkflows?.filter(w => w.process_template_id).map(w => w.process_template_id) || []
    );
    const subProcessWorkflowIds = new Set(
      existingWorkflows?.filter(w => w.sub_process_template_id).map(w => w.sub_process_template_id) || []
    );

    return {
      processes: (processes || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        hasWorkflow: processWorkflowIds.has(p.id),
        subProcessCount: p.sub_process_templates?.length || 0,
      })),
      subProcesses: (subProcesses || []).map((sp: any) => ({
        id: sp.id,
        name: sp.name,
        hasWorkflow: subProcessWorkflowIds.has(sp.id),
        taskCount: sp.task_templates?.length || 0,
        processName: sp.process_templates?.name || null,
      })),
    };
  }, []);

  const regenerateWorkflows = useCallback(async (
    options: SelectionOptions = {}
  ): Promise<RegenerationSummary> => {
    if (!user) {
      toast.error('Vous devez être connecté');
      return { total: 0, created: 0, updated: 0, skipped: 0, errors: 0, results: [] };
    }

    const { processIds, subProcessIds, forceRegenerate = false, dryRun = false } = options;
    const results: RegenerationResult[] = [];
    
    setIsRunning(true);
    
    try {
      // Build queries - include process_template_id to check INTERVENTION BE
      let subProcessQuery = supabase
        .from('sub_process_templates')
        .select(`
          id,
          name,
          process_template_id,
          target_manager_id,
          target_department_id,
          target_assignee_id,
          assignment_type,
          task_templates (id, title, default_duration_days),
          process_templates (name)
        `);

      let processQuery = supabase
        .from('process_templates')
        .select(`
          id,
          name,
          sub_process_templates (id, name)
        `);

      // Apply filters
      if (subProcessIds && subProcessIds.length > 0) {
        subProcessQuery = subProcessQuery.in('id', subProcessIds);
      }
      if (processIds && processIds.length > 0) {
        processQuery = processQuery.in('id', processIds);
      }

      const [{ data: subProcesses }, { data: processes }] = await Promise.all([
        subProcessQuery,
        processQuery,
      ]);

      // Get existing workflows
      const { data: existingWorkflows } = await supabase
        .from('workflow_templates')
        .select('id, sub_process_template_id, process_template_id')
        .eq('is_default', true);

      const existingSubProcessWorkflows = new Map<string, string>(
        existingWorkflows
          ?.filter(w => w.sub_process_template_id)
          .map(w => [w.sub_process_template_id!, w.id]) || []
      );
      const existingProcessWorkflows = new Map<string, string>(
        existingWorkflows
          ?.filter(w => w.process_template_id)
          .map(w => [w.process_template_id!, w.id]) || []
      );

      const totalItems = (subProcesses?.length || 0) + (processes?.length || 0);
      setProgress({ current: 0, total: totalItems });

      // Track sub-processes belonging to INTERVENTION BE for preset application
      const interventionBESubProcessIds: string[] = [];

      // Process sub-processes
      for (const sp of (subProcesses || [])) {
        const hasExisting = existingSubProcessWorkflows.has(sp.id);
        const processName = (sp as any).process_templates?.name;
        const isInterventionBE = isInterventionBEProcess(processName);

        if (hasExisting && !forceRegenerate) {
          results.push({
            id: sp.id,
            name: sp.name,
            type: 'subprocess',
            status: 'skipped',
            message: 'Workflow existant conservé',
            hasExistingWorkflow: true,
            taskCount: sp.task_templates?.length || 0,
          });
          
          // For "generate missing only" mode on INTERVENTION BE: apply preset if config is empty
          if (isInterventionBE) {
            interventionBESubProcessIds.push(sp.id);
          }
        } else {
          if (dryRun) {
            results.push({
              id: sp.id,
              name: sp.name,
              type: 'subprocess',
              status: hasExisting ? 'updated' : 'created',
              message: dryRun ? '[Dry-run] Workflow serait ' + (hasExisting ? 'régénéré' : 'créé') : undefined,
              hasExistingWorkflow: hasExisting,
              taskCount: sp.task_templates?.length || 0,
            });
          } else {
            try {
              // Delete existing if regenerating
              if (hasExisting) {
                await supabase
                  .from('workflow_templates')
                  .delete()
                  .eq('id', existingSubProcessWorkflows.get(sp.id)!);
              }

              const workflowId = await createSubProcessWorkflow(
                sp.id,
                sp.name,
                user.id,
                sp.task_templates || [],
                {
                  target_manager_id: sp.target_manager_id,
                  target_department_id: sp.target_department_id,
                  target_assignee_id: sp.target_assignee_id,
                  assignment_type: sp.assignment_type,
                }
              );

              // Track INTERVENTION BE sub-processes for preset application
              if (isInterventionBE) {
                interventionBESubProcessIds.push(sp.id);
              }

              results.push({
                id: sp.id,
                name: sp.name,
                type: 'subprocess',
                status: hasExisting ? 'updated' : 'created',
                hasExistingWorkflow: hasExisting,
                taskCount: sp.task_templates?.length || 0,
              });
            } catch (error) {
              results.push({
                id: sp.id,
                name: sp.name,
                type: 'subprocess',
                status: 'error',
                message: String(error),
                hasExistingWorkflow: hasExisting,
              });
            }
          }
        }

        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }

      // Apply INTERVENTION BE preset to collected sub-processes
      if (interventionBESubProcessIds.length > 0 && !dryRun) {
        console.log(`[Workflow Regeneration] Applying INTERVENTION BE preset to ${interventionBESubProcessIds.length} sub-processes`);
        const presetResult = await applyInterventionBEPresetToSubProcesses(
          interventionBESubProcessIds,
          forceRegenerate // forceOverwrite matches forceRegenerate mode
        );
        console.log(`[Workflow Regeneration] INTERVENTION BE preset applied:`, presetResult);
      }

      // Process processes - also apply INTERVENTION BE preset to their sub-processes
      for (const p of (processes || [])) {
        const hasExisting = existingProcessWorkflows.has(p.id);
        const isInterventionBE = isInterventionBEProcess(p.name);

        if (hasExisting && !forceRegenerate) {
          results.push({
            id: p.id,
            name: p.name,
            type: 'process',
            status: 'skipped',
            message: 'Workflow existant conservé',
            hasExistingWorkflow: true,
          });
          
          // Even when skipping process workflow, apply preset to sub-processes if INTERVENTION BE
          if (isInterventionBE && !dryRun) {
            const subProcessIds = await getSubProcessIdsForProcess(p.id);
            if (subProcessIds.length > 0) {
              console.log(`[Workflow Regeneration] Applying INTERVENTION BE preset (skipped process) to ${subProcessIds.length} sub-processes`);
              await applyInterventionBEPresetToSubProcesses(subProcessIds, false);
            }
          }
        } else {
          if (dryRun) {
            results.push({
              id: p.id,
              name: p.name,
              type: 'process',
              status: hasExisting ? 'updated' : 'created',
              message: '[Dry-run] Workflow serait ' + (hasExisting ? 'régénéré' : 'créé'),
              hasExistingWorkflow: hasExisting,
            });
          } else {
            try {
              if (hasExisting) {
                await supabase
                  .from('workflow_templates')
                  .delete()
                  .eq('id', existingProcessWorkflows.get(p.id)!);
              }

              const workflowId = await createProcessWorkflow(
                p.id,
                p.name,
                user.id,
                p.sub_process_templates || []
              );

              // Apply INTERVENTION BE preset to all sub-processes of this process
              if (isInterventionBE) {
                const subProcessIds = (p.sub_process_templates || []).map(sp => sp.id);
                if (subProcessIds.length > 0) {
                  console.log(`[Workflow Regeneration] Applying INTERVENTION BE preset (regenerated process) to ${subProcessIds.length} sub-processes`);
                  await applyInterventionBEPresetToSubProcesses(subProcessIds, forceRegenerate);
                }
              }

              results.push({
                id: p.id,
                name: p.name,
                type: 'process',
                status: hasExisting ? 'updated' : 'created',
                hasExistingWorkflow: hasExisting,
              });
            } catch (error) {
              results.push({
                id: p.id,
                name: p.name,
                type: 'process',
                status: 'error',
                message: String(error),
                hasExistingWorkflow: hasExisting,
              });
            }
          }
        }

        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }

      const summary: RegenerationSummary = {
        total: results.length,
        created: results.filter(r => r.status === 'created').length,
        updated: results.filter(r => r.status === 'updated').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        errors: results.filter(r => r.status === 'error').length,
        results,
      };

      if (!dryRun) {
        toast.success(
          `Régénération terminée: ${summary.created} créés, ${summary.updated} mis à jour`
        );
      }

      return summary;
    } catch (error) {
      console.error('Error in workflow regeneration:', error);
      toast.error('Erreur lors de la régénération');
      return { total: 0, created: 0, updated: 0, skipped: 0, errors: 1, results: [] };
    } finally {
      setIsRunning(false);
      setProgress({ current: 0, total: 0 });
    }
  }, [user]);

  return {
    analyzeWorkflows,
    regenerateWorkflows,
    isRunning,
    progress,
  };
}
