import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ActiveProfile {
  id: string;
  display_name: string;
  job_title: string | null;
}

/** Collaborateurs actifs (pour valoriser le temps via leur TJM par fonction). */
export function useActiveProfiles() {
  return useQuery<ActiveProfile[]>({
    queryKey: ['active-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, job_title')
        .eq('status', 'active')
        .order('display_name');
      if (error) throw error;
      return (data ?? []) as ActiveProfile[];
    },
    staleTime: 5 * 60_000,
  });
}
