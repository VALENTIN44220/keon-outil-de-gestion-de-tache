import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ITProjectLuccaCode } from '@/types/itProject';

export function useITProjectLuccaCodes(projectId: string | undefined) {
  return useQuery<ITProjectLuccaCode[]>({
    queryKey: ['it-project-lucca-codes', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('it_project_lucca_codes')
        .select('*')
        .eq('it_project_id', projectId!)
        .order('code_site');
      if (error) throw error;
      return (data ?? []) as ITProjectLuccaCode[];
    },
    staleTime: 30_000,
  });
}

export function useAddITProjectLuccaCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: { it_project_id: string; code_site: string }) => {
      const { data, error } = await supabase
        .from('it_project_lucca_codes')
        .insert({ ...row, code_site: row.code_site.trim() })
        .select()
        .single();
      if (error) throw error;
      return data as ITProjectLuccaCode;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['it-project-lucca-codes', v.it_project_id] });
      qc.invalidateQueries({ queryKey: ['it-project-temps-reel', v.it_project_id] });
    },
  });
}

export function useDeleteITProjectLuccaCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; projectId: string }) => {
      const { error } = await supabase.from('it_project_lucca_codes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['it-project-lucca-codes', v.projectId] });
      qc.invalidateQueries({ queryKey: ['it-project-temps-reel', v.projectId] });
    },
  });
}
