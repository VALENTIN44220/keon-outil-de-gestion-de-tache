import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FdrSettings, FdrProfil } from '@/types/fdr';

// ---- Paramètres globaux FDR ----

export function useFdrSettings() {
  return useQuery<FdrSettings | null>({
    queryKey: ['fdr-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fdr_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as FdrSettings | null;
    },
    staleTime: 60_000,
  });
}

export function useUpdateFdrSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Omit<FdrSettings, 'id' | 'created_at' | 'updated_at'>>) => {
      // Singleton : on récupère l'id puis on UPSERT
      const { data: existing } = await supabase
        .from('fdr_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      // cast : les nouveaux champs (seuil/part risque) ne sont pas encore dans
      // les types générés de fdr_settings.
      const db = supabase as any;
      if (existing) {
        const { error } = await db
          .from('fdr_settings')
          .update(patch)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await db.from('fdr_settings').insert(patch);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fdr-settings'] }),
  });
}

// ---- Profils capacitaires ----

export function useFdrProfils() {
  return useQuery<FdrProfil[]>({
    queryKey: ['fdr-profils'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fdr_profils')
        .select('*')
        .order('ordre');
      if (error) throw error;
      return (data ?? []) as FdrProfil[];
    },
    staleTime: 60_000,
  });
}

export function useUpdateFdrProfil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<FdrProfil> & { id: string }) => {
      const { error } = await supabase.from('fdr_profils').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fdr-profils'] }),
  });
}

export function useAddFdrProfil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profil: Omit<FdrProfil, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase.from('fdr_profils').insert(profil);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fdr-profils'] }),
  });
}

export function useDeleteFdrProfil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fdr_profils').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fdr-profils'] }),
  });
}
