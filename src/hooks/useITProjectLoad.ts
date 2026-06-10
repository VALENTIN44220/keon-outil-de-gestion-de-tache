import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ITProjectLoad } from '@/types/fdr';

export function useITProjectLoad(projectId: string | undefined) {
  return useQuery<ITProjectLoad[]>({
    queryKey: ['it-project-load', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('it_project_load')
        .select('*, profil:fdr_profils(*)')
        .eq('it_project_id', projectId!)
        .order('profil(ordre)');
      if (error) throw error;
      return (data ?? []) as ITProjectLoad[];
    },
    staleTime: 30_000,
  });
}

/** Upsert complet de la ventilation build (remplace toutes les lignes du projet). */
export function useUpsertITProjectLoad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      loads,
    }: {
      projectId: string;
      loads: Array<{ profil_id: string; j_mois: number }>;
    }) => {
      // Supprime les lignes existantes puis réinsère
      const { error: delErr } = await supabase
        .from('it_project_load')
        .delete()
        .eq('it_project_id', projectId);
      if (delErr) throw delErr;

      const rows = loads
        .filter(l => l.j_mois > 0)
        .map(l => ({ it_project_id: projectId, profil_id: l.profil_id, j_mois: l.j_mois }));

      if (rows.length > 0) {
        const { error: insErr } = await supabase.from('it_project_load').insert(rows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: (_data, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['it-project-load', projectId] });
      // Invalide aussi la matrice capacité globale
      qc.invalidateQueries({ queryKey: ['fdr-capacity-matrix'] });
    },
  });
}
