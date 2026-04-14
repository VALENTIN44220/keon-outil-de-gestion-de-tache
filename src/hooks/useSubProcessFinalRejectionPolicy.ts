import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getFinalRejectionReturnsToExecutor } from '@/lib/standardWorkflowTemplate';

/**
 * Option « refus validation finale → retour exécuteur » du workflow standard lié au sous-processus.
 */
export function useSubProcessFinalRejectionPolicy(subProcessTemplateId: string | null | undefined) {
  const [returnsToExecutor, setReturnsToExecutor] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!subProcessTemplateId) {
      setReturnsToExecutor(true);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const { data } = await supabase
        .from('wf_workflows')
        .select('standard_options')
        .eq('sub_process_template_id', subProcessTemplateId)
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!cancelled) {
        setReturnsToExecutor(getFinalRejectionReturnsToExecutor(data?.standard_options));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [subProcessTemplateId]);

  return returnsToExecutor;
}
