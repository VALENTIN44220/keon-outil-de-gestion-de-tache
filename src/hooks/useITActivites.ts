import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ACTIVITES_METIER } from '@/types/fdr';

export interface ITActiviteOption {
  id: string;
  libelle: string;
  ordre: number;
  actif: boolean;
  created_at?: string;
  updated_at?: string;
}

const KEY = ['it-activites'];

// La table it_activites n'est pas (encore) dans les types générés : on caste
// l'accès au client. Le typage métier est assuré par ITActiviteOption.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = () => (supabase as any).from('it_activites');

/**
 * Activités métier paramétrables (table it_activites).
 * Repli sur la liste historique ACTIVITES_METIER si la table est vide / indispo.
 */
export function useITActivites() {
  const qc = useQueryClient();

  const list = useQuery<ITActiviteOption[]>({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await tbl()
        .select('*')
        .order('ordre', { ascending: true })
        .order('libelle', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ITActiviteOption[];
    },
    staleTime: 60_000,
  });

  const activites = useMemo(() => list.data ?? [], [list.data]);

  /**
   * Libellés proposés dans les listes déroulantes : table en priorité,
   * repli sur la liste historique si la table n'a pas (encore) chargé.
   */
  const activeLabels = useMemo<string[]>(() => {
    const fromDb = activites.filter(a => a.actif).map(a => a.libelle);
    return fromDb.length > 0 ? fromDb : [...ACTIVITES_METIER];
  }, [activites]);

  const add = useMutation({
    mutationFn: async (payload: { libelle: string; ordre?: number }) => {
      const { data, error } = await tbl()
        .insert({
          libelle: payload.libelle.trim(),
          ordre: payload.ordre ?? (activites.length + 1),
          actif: true,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ITActiviteOption;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<Pick<ITActiviteOption, 'libelle' | 'ordre' | 'actif'>>) => {
      const { error } = await tbl()
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await tbl().delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  return {
    activites,
    activeLabels,
    isLoading: list.isLoading,
    add,
    update,
    remove,
  };
}
