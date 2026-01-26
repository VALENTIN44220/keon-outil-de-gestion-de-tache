import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ensureSubProcessWorkflow, 
  ensureProcessWorkflow 
} from '@/hooks/useAutoWorkflowGeneration';
import { toast } from 'sonner';

interface MigrationResult {
  total: number;
  created: number;
  existing: number;
  errors: number;
}

export function useWorkflowAutoGeneration() {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const generateAllMissingWorkflows = async (): Promise<{
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
      // Fetch all sub-processes
      const { data: subProcesses } = await supabase
        .from('sub_process_templates')
        .select('id, name');

      // Fetch all processes
      const { data: processes } = await supabase
        .from('process_templates')
        .select('id, name');

      const totalItems = (subProcesses?.length || 0) + (processes?.length || 0);
      setProgress({ current: 0, total: totalItems });

      // Generate workflows for sub-processes
      if (subProcesses) {
        subProcessResult.total = subProcesses.length;
        for (const sp of subProcesses) {
          try {
            const result = await ensureSubProcessWorkflow(sp.id, sp.name, user.id);
            if (result) {
              // Check if it was newly created or already existed
              const { data: existing } = await supabase
                .from('workflow_templates')
                .select('created_at')
                .eq('id', result)
                .single();
              
              // If created within last second, it's new
              if (existing && new Date(existing.created_at).getTime() > Date.now() - 2000) {
                subProcessResult.created++;
              } else {
                subProcessResult.existing++;
              }
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
            const result = await ensureProcessWorkflow(p.id, p.name, user.id);
            if (result) {
              const { data: existing } = await supabase
                .from('workflow_templates')
                .select('created_at')
                .eq('id', result)
                .single();
              
              if (existing && new Date(existing.created_at).getTime() > Date.now() - 2000) {
                processResult.created++;
              } else {
                processResult.existing++;
              }
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
