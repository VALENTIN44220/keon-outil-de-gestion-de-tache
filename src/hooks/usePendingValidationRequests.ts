import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Task } from '@/types/task';

/**
 * Hook to fetch requests pending validation for the current user.
 * A user sees requests where they are the designated validator at the current pending level.
 */
export function usePendingValidationRequests() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPendingValidations = useCallback(async () => {
    if (!profile?.id) return;

    setIsLoading(true);
    try {
      // Fetch requests pending level 1 where current user is validator 1
      const { data: level1 } = await supabase
        .from('tasks')
        .select('*')
        .eq('type', 'request')
        .eq('request_validation_status', 'pending_level_1')
        .eq('request_validator_id_1', profile.id)
        .order('created_at', { ascending: false });

      // Fetch requests pending level 2 where current user is validator 2
      const { data: level2 } = await supabase
        .from('tasks')
        .select('*')
        .eq('type', 'request')
        .eq('request_validation_status', 'pending_level_2')
        .eq('request_validator_id_2', profile.id)
        .order('created_at', { ascending: false });

      const all = [...(level1 || []), ...(level2 || [])] as Task[];
      // Deduplicate by id
      const unique = Array.from(new Map(all.map(r => [r.id, r])).values());
      setRequests(unique);
    } catch (error) {
      console.error('Error fetching pending validations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchPendingValidations();
  }, [fetchPendingValidations]);

  return {
    requests,
    count: requests.length,
    isLoading,
    refetch: fetchPendingValidations,
  };
}
