import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  FLUX_TYPE_CONFIG,
  PRESET_FREQUENCES,
  PRESET_PROTOCOLES,
} from '@/types/itSolution';

export type LinkOptionType = 'type_flux' | 'protocole' | 'frequence';

export interface ITSolutionLinkOption {
  id: string;
  option_type: LinkOptionType;
  value: string;
  created_at: string;
  created_by?: string | null;
}

const KEY = ['it-solution-link-options'];

/**
 * Catalogue partage des valeurs personnalisees pour type_flux / protocole /
 * frequence des liens entre solutions IT. Fusionne les presets de code
 * (constants partages) avec les valeurs utilisateurs en base.
 */
export function useITSolutionLinkOptions() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<ITSolutionLinkOption[]> => {
      const { data, error } = await supabase
        .from('it_solution_link_options')
        .select('*')
        .order('value', { ascending: true });
      if (error) throw error;
      return (data as ITSolutionLinkOption[]) ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const addOption = useMutation({
    mutationFn: async (payload: { option_type: LinkOptionType; value: string }) => {
      const trimmed = payload.value.trim();
      if (!trimmed) return null;
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('it_solution_link_options')
        .insert({
          option_type: payload.option_type,
          value: trimmed,
          created_by: auth.user?.id ?? null,
        })
        .select()
        .single();
      // 23505 = unique violation : valeur deja presente, on ignore silencieusement
      if (error && (error as { code?: string }).code !== '23505') throw error;
      return data as ITSolutionLinkOption | null;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const options = useMemo(() => query.data ?? [], [query.data]);

  /** Preset code (label + couleur) + valeurs custom de la DB. */
  const typeFluxOptions = useMemo(() => {
    const base = Object.entries(FLUX_TYPE_CONFIG).map(([value, cfg]) => ({
      value,
      label: cfg.label,
    }));
    const presetSet = new Set(base.map((b) => b.value));
    const custom = options
      .filter((o) => o.option_type === 'type_flux' && !presetSet.has(o.value))
      .map((o) => ({ value: o.value, label: o.value }));
    return [...base, ...custom];
  }, [options]);

  const protocoleOptions = useMemo(() => {
    const base = PRESET_PROTOCOLES.map((p) => ({ value: p, label: p }));
    const presetSet = new Set<string>(PRESET_PROTOCOLES);
    const custom = options
      .filter((o) => o.option_type === 'protocole' && !presetSet.has(o.value))
      .map((o) => ({ value: o.value, label: o.value }));
    return [...base, ...custom];
  }, [options]);

  const frequenceOptions = useMemo(() => {
    const base = PRESET_FREQUENCES.map((p) => ({ value: p, label: p }));
    const presetSet = new Set<string>(PRESET_FREQUENCES);
    const custom = options
      .filter((o) => o.option_type === 'frequence' && !presetSet.has(o.value))
      .map((o) => ({ value: o.value, label: o.value }));
    return [...base, ...custom];
  }, [options]);

  return {
    ...query,
    typeFluxOptions,
    protocoleOptions,
    frequenceOptions,
    addOption,
  };
}
