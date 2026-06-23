import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { IT_PROJECT_TYPE_CONFIG } from '@/types/itProject';

export interface ITProjectTypeOption {
  id: string;
  value: string;
  label: string;
  icon: string;
  ordre: number;
  actif: boolean;
  created_at?: string;
  updated_at?: string;
}

const KEY = ['it-project-types'];

/** Slugifie un libellé en valeur stockable (a-z0-9_). */
export function slugifyTypeValue(label: string): string {
  return label
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'type';
}

export function useITProjectTypes() {
  const qc = useQueryClient();

  const list = useQuery<ITProjectTypeOption[]>({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('it_project_types')
        .select('*')
        .order('ordre', { ascending: true })
        .order('label', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ITProjectTypeOption[];
    },
    staleTime: 60_000,
  });

  const types = useMemo(() => list.data ?? [], [list.data]);

  /** Map value → { label, icon } : DB en priorité, fallback sur les built-ins puis la valeur brute. */
  const resolve = useMemo(() => {
    const map = new Map<string, { label: string; icon: string }>();
    for (const [value, cfg] of Object.entries(IT_PROJECT_TYPE_CONFIG)) map.set(value, cfg);
    for (const t of types) map.set(t.value, { label: t.label, icon: t.icon });
    return (value: string | null | undefined): { label: string; icon: string } => {
      if (!value) return { label: '—', icon: '' };
      return map.get(value) ?? { label: value, icon: '📦' };
    };
  }, [types]);

  const add = useMutation({
    mutationFn: async (payload: { value?: string; label: string; icon?: string; ordre?: number }) => {
      const value = (payload.value?.trim() || slugifyTypeValue(payload.label));
      const { data, error } = await supabase
        .from('it_project_types')
        .insert({
          value,
          label: payload.label.trim(),
          icon: payload.icon?.trim() || '📦',
          ordre: payload.ordre ?? (types.length + 1),
          actif: true,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ITProjectTypeOption;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<Pick<ITProjectTypeOption, 'label' | 'icon' | 'ordre' | 'actif'>>) => {
      const { error } = await supabase
        .from('it_project_types')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('it_project_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  return {
    types,
    activeTypes: types.filter(t => t.actif),
    isLoading: list.isLoading,
    resolve,
    add,
    update,
    remove,
  };
}
