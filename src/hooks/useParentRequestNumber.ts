import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetches the request_number of the parent request for a given task.
 * Returns null if there's no parent_request_id.
 */
export function useParentRequestNumber(parentRequestId: string | null) {
  const [requestNumber, setRequestNumber] = useState<string | null>(null);

  useEffect(() => {
    if (!parentRequestId) {
      setRequestNumber(null);
      return;
    }

    let cancelled = false;

    supabase
      .from('tasks')
      .select('request_number')
      .eq('id', parentRequestId)
      .single()
      .then(({ data }) => {
        if (!cancelled) {
          setRequestNumber(data?.request_number || null);
        }
      });

    return () => { cancelled = true; };
  }, [parentRequestId]);

  return requestNumber;
}
