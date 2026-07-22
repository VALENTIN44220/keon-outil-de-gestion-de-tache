import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ITTjmReferentiel } from '@/types/itProject';

export function useITTjmReferentiel() {
  return useQuery<ITTjmReferentiel[]>({
    queryKey: ['it-tjm-referentiel'],
    queryFn: async () => {
      // be_fonction n'est pas (encore) dans les types générés → cast du client.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
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
    mutationFn: async (row: { profil_code: string; tjm_eur: number; be_fonction?: string | null; description?: string | null }) => {
      // be_fonction n'est pas (encore) dans les types générés → cast du client.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('it_tjm_referentiel')
        .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'profil_code' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['it-tjm-referentiel'] }),
  });
}

export function useDeleteITTjmReferentiel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profil_code: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('it_tjm_referentiel')
        .delete()
        .eq('profil_code', profil_code);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['it-tjm-referentiel'] }),
  });
}
