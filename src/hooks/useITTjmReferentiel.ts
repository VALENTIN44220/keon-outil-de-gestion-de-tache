import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ITTjmReferentiel } from '@/types/itProject';

export function useITTjmReferentiel() {
  return useQuery<ITTjmReferentiel[]>({
    queryKey: ['it-tjm-referentiel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('it_tjm_referentiel')
        .select('*')
        .order('profil_code');
      if (error) throw error;
      return (data ?? []) as ITTjmReferentiel[];
    },
    staleTime: 60_000,
  });
}

export function useUpsertITTjmReferentiel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: { profil_code: string; tjm_eur: number; description?: string | null }) => {
      const { error } = await supabase
        .from('it_tjm_referentiel')
        .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'profil_code' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['it-tjm-referentiel'] }),
  });
}
