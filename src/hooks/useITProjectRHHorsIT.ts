import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ITProjectRHHorsIT, ITRHHorsITUnite } from '@/types/itProject';

export function useITProjectRHHorsIT(projectId: string | undefined) {
  return useQuery<ITProjectRHHorsIT[]>({
    queryKey: ['it-project-rh-hors-it', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('it_project_rh_hors_it')
        .select('*')
        .eq('it_project_id', projectId!)
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as ITProjectRHHorsIT[];
    },
    staleTime: 30_000,
  });
}

export function useAddITProjectRHHorsIT() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: {
      it_project_id: string;
      profil_label: string;
      j_build?: number | null;
      unite: ITRHHorsITUnite;
      jours_an?: number | null;
      jours_par_spv?: number | null;
      nb_spv?: number | null;
      tjm_interne: number;
      note?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('it_project_rh_hors_it')
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data as ITProjectRHHorsIT;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['it-project-rh-hors-it', v.it_project_id] }),
  });
}

export function useUpdateITProjectRHHorsIT() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      projectId,
      ...patch
    }: Partial<ITProjectRHHorsIT> & { id: string; projectId: string }) => {
      const { error } = await supabase
        .from('it_project_rh_hors_it')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['it-project-rh-hors-it', v.projectId] }),
  });
}

export function useDeleteITProjectRHHorsIT() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase.from('it_project_rh_hors_it').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['it-project-rh-hors-it', v.projectId] }),
  });
}
