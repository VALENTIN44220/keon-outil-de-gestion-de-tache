import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ITProjectTempsManuel } from '@/types/itProject';

export function useITProjectTempsManuel(projectId: string | undefined) {
  return useQuery<ITProjectTempsManuel[]>({
    queryKey: ['it-project-temps-manuel', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('it_project_temps_manuel')
        .select('*')
        .eq('it_project_id', projectId!)
        .order('mois', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ITProjectTempsManuel[];
    },
    staleTime: 30_000,
  });
}

const invalidate = (qc: ReturnType<typeof useQueryClient>, projectId: string) => {
  qc.invalidateQueries({ queryKey: ['it-project-temps-manuel', projectId] });
  qc.invalidateQueries({ queryKey: ['it-project-temps-reel', projectId] });
};

export function useAddITProjectTempsManuel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: {
      it_project_id: string;
      user_id?: string | null;
      profil_label?: string | null;
      mois?: string | null;
      jours: number;
      note?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('it_project_temps_manuel')
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data as ITProjectTempsManuel;
    },
    onSuccess: (_d, v) => invalidate(qc, v.it_project_id),
  });
}

export function useUpdateITProjectTempsManuel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      projectId,
      ...patch
    }: Partial<ITProjectTempsManuel> & { id: string; projectId: string }) => {
      const { error } = await supabase
        .from('it_project_temps_manuel')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => invalidate(qc, v.projectId),
  });
}

export function useDeleteITProjectTempsManuel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; projectId: string }) => {
      const { error } = await supabase.from('it_project_temps_manuel').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => invalidate(qc, v.projectId),
  });
}
