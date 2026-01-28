import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  createSubProcessWorkflow,
  createProcessWorkflow,
} from '@/hooks/useAutoWorkflowGeneration';
import { toast } from 'sonner';

interface MigrationResult {
  total: number;
  created: number;
  existing: number;
  errors: number;
}

interface SelectionOptions {
  processIds?: string[];
  subProcessIds?: string[];
}

export function useWorkflowAutoGeneration() {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const generateAllMissingWorkflows = async (
    forceRegenerate = false,
    selection?: SelectionOptions
  ): Promise<{
    subProcesses: MigrationResult;
    processes: MigrationResult;
  }> => {
    if (!user) {
      toast.error('Vous devez être connecté');
      return {
        subProcesses: { total: 0, created: 0, existing: 0, errors: 0 },
        processes: { total: 0, created: 0, existing: 0, errors: 0 },
      };
    }

    setIsGenerating(true);
    const subProcessResult: MigrationResult = { total: 0, created: 0, existing: 0, errors: 0 };
    const processResult: MigrationResult = { total: 0, created: 0, existing: 0, errors: 0 };

    try {
      // Build queries with optional filtering
      let subProcessQuery = supabase
        .from('sub_process_templates')
        .select(`
          id, 
          name,
          target_manager_id,
          target_department_id,
          task_templates (
            id,
            title,
            default_duration_days
          )
        `);

      let processQuery = supabase
        .from('process_templates')
        .select(`
          id, 
          name,
          sub_process_templates (
            id,
            name
          )
        `);

      // Apply selection filters if provided
      if (selection?.subProcessIds && selection.subProcessIds.length > 0) {
        subProcessQuery = subProcessQuery.in('id', selection.subProcessIds);
      }
      if (selection?.processIds && selection.processIds.length > 0) {
        processQuery = processQuery.in('id', selection.processIds);
      }

      const { data: subProcesses } = await subProcessQuery;
      const { data: processes } = await processQuery;

      // Check existing workflows
      const { data: existingWorkflows } = await supabase
        .from('workflow_templates')
        .select('sub_process_template_id, process_template_id')
        .eq('is_default', true);

      const existingSubProcessIds = new Set(
        existingWorkflows
          ?.filter(w => w.sub_process_template_id)
          .map(w => w.sub_process_template_id) || []
      );
      const existingProcessIds = new Set(
        existingWorkflows
          ?.filter(w => w.process_template_id)
          .map(w => w.process_template_id) || []
      );

      const totalItems = (subProcesses?.length || 0) + (processes?.length || 0);
      setProgress({ current: 0, total: totalItems });

      // Generate workflows for sub-processes
      if (subProcesses) {
        subProcessResult.total = subProcesses.length;
        for (const sp of subProcesses) {
          try {
            // Skip if already exists and not forcing regeneration
            if (existingSubProcessIds.has(sp.id) && !forceRegenerate) {
              subProcessResult.existing++;
              setProgress(prev => ({ ...prev, current: prev.current + 1 }));
              continue;
            }

            // Delete existing workflow if forcing regeneration
            if (forceRegenerate && existingSubProcessIds.has(sp.id)) {
              await supabase
                .from('workflow_templates')
                .delete()
                .eq('sub_process_template_id', sp.id)
                .eq('is_default', true);
            }

            const result = await createSubProcessWorkflow(
              sp.id, 
              sp.name, 
              user.id,
              sp.task_templates || [],
              {
                target_manager_id: sp.target_manager_id,
                target_department_id: sp.target_department_id,
              }
            );
            
            if (result) {
              subProcessResult.created++;
            } else {
              subProcessResult.errors++;
            }
          } catch (error) {
            console.error(`Error generating workflow for sub-process ${sp.id}:`, error);
            subProcessResult.errors++;
          }
          setProgress(prev => ({ ...prev, current: prev.current + 1 }));
        }
      }

      // Generate workflows for processes
      if (processes) {
        processResult.total = processes.length;
        for (const p of processes) {
          try {
            if (existingProcessIds.has(p.id) && !forceRegenerate) {
              processResult.existing++;
              setProgress(prev => ({ ...prev, current: prev.current + 1 }));
              continue;
            }

            if (forceRegenerate && existingProcessIds.has(p.id)) {
              await supabase
                .from('workflow_templates')
                .delete()
                .eq('process_template_id', p.id)
                .eq('is_default', true);
            }

            const result = await createProcessWorkflow(
              p.id, 
              p.name, 
              user.id,
              p.sub_process_templates || []
            );
            
            if (result) {
              processResult.created++;
            } else {
              processResult.errors++;
            }
          } catch (error) {
            console.error(`Error generating workflow for process ${p.id}:`, error);
            processResult.errors++;
          }
          setProgress(prev => ({ ...prev, current: prev.current + 1 }));
        }
      }

      toast.success(
        `Génération terminée: ${subProcessResult.created + processResult.created} workflows créés`
      );
    } catch (error) {
      console.error('Error in workflow generation:', error);
      toast.error('Erreur lors de la génération');
    } finally {
      setIsGenerating(false);
      setProgress({ current: 0, total: 0 });
    }

    return { subProcesses: subProcessResult, processes: processResult };
  };

  return {
    generateAllMissingWorkflows,
    isGenerating,
    progress,
  };
}
