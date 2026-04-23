import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ITBudgetOption, ITBudgetOptionType } from '@/types/itProject';

/**
 * Valeurs de base (présélection) pour catégorie et sous-catégorie.
 * Elles sont fusionnées avec les valeurs personnalisées stockées côté DB
 * dans it_budget_options — permet à n'importe quel utilisateur d'ajouter
 * de nouveaux choix à la volée.
 */
export const PRESET_CATEGORIES = ['IT', 'IT ERP'] as const;

export const PRESET_SOUS_CATEGORIES: Record<string, string[]> = {
  IT: [
    'Users', 'Réseau', 'Maintenance', 'Amazon', 'Téléphonie',
    'Doubletrade', 'Adobe', 'Anydesk', 'Nanosystem', 'PROCONSULTEAM',
    'Bright fastspring', 'Ceciaa', 'Aleas', 'EBP', 'Yousign',
    'Pentest', 'ARCGIS', 'Copilot', 'Autre',
  ],
  'IT ERP': [
    'Exalog Cegid', 'E-attestation', 'Veremes', 'Lucca', 'Divalto',
    'Yooz', 'BLC Pipedrive', 'lucanet', 'CreditSafe', 'Autre',
  ],
};

export function useITBudgetOptions() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['it-budget-options'],
    queryFn: async (): Promise<ITBudgetOption[]> => {
      const { data, error } = await supabase
        .from('it_budget_options')
        .select('*')
        .order('value', { ascending: true });
      if (error) throw error;
      return (data as ITBudgetOption[]) ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const addOption = useMutation({
    mutationFn: async (payload: {
      option_type: ITBudgetOptionType;
      value: string;
      parent_value?: string | null;
    }) => {
      const trimmed = payload.value.trim();
      if (!trimmed) return null;
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('it_budget_options')
        .insert({
          option_type: payload.option_type,
          value: trimmed,
          parent_value: payload.parent_value ?? null,
          created_by: auth.user?.id ?? null,
        })
        .select()
        .single();
      // 23505 = unique violation → déjà présent, on ignore silencieusement
      if (error && (error as { code?: string }).code !== '23505') throw error;
      return data as ITBudgetOption | null;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['it-budget-options'] }),
  });

  const options = useMemo(() => query.data ?? [], [query.data]);

  const categorieOptions = useMemo(() => {
    const custom = options
      .filter((o) => o.option_type === 'categorie')
      .map((o) => o.value);
    return Array.from(new Set([...PRESET_CATEGORIES, ...custom]));
  }, [options]);

  const getSousCategorieOptions = (categorie: string | null | undefined): string[] => {
    const preset = categorie ? (PRESET_SOUS_CATEGORIES[categorie] ?? []) : [];
    const custom = options
      .filter(
        (o) =>
          o.option_type === 'sous_categorie' &&
          (o.parent_value ?? '') === (categorie ?? '')
      )
      .map((o) => o.value);
    return Array.from(new Set([...preset, ...custom])).filter(
      (s) => s && s.trim() !== ''
    );
  };

  const natureDepenseOptions = useMemo(() => {
    const custom = options
      .filter((o) => o.option_type === 'nature_depense')
      .map((o) => o.value);
    return Array.from(new Set(custom));
  }, [options]);

  return {
    ...query,
    categorieOptions,
    getSousCategorieOptions,
    natureDepenseOptions,
    addOption,
  };
}
