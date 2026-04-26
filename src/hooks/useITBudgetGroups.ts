import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ITBudgetRapprochementGroup } from '@/types/itProject';

/**
 * Gère les groupes de rapprochement IT (CRUD) et l'assignation de lignes
 * budgétaires à un groupe. Les noms de queries invalidées couvrent
 * également les vues qui en dépendent (lignes globales, breakdown).
 */
export function useITBudgetGroups() {
  const qc = useQueryClient();

  const groupsQuery = useQuery({
    queryKey: ['it-budget-groups'],
    queryFn: async (): Promise<ITBudgetRapprochementGroup[]> => {
      const { data, error } = await supabase
        .from('it_budget_rapprochement_groups')
        .select('*')
        .order('nom', { ascending: true });
      if (error) throw error;
      return (data as ITBudgetRapprochementGroup[]) ?? [];
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['it-budget-groups'] });
    qc.invalidateQueries({ queryKey: ['it-budget-global-lines'] });
    qc.invalidateQueries({ queryKey: ['it-budget-lines'] });
  };

  const createGroup = useMutation({
    mutationFn: async (payload: { nom: string; description?: string | null; exercice?: number | null; entite?: string | null }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('it_budget_rapprochement_groups')
        .insert({
          nom: payload.nom.trim(),
          description: payload.description ?? null,
          exercice: payload.exercice ?? null,
          entite: payload.entite ?? null,
          created_by: auth.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ITBudgetRapprochementGroup;
    },
    onSuccess: invalidateAll,
  });

  const renameGroup = useMutation({
    mutationFn: async ({ id, nom, description }: { id: string; nom: string; description?: string | null }) => {
      const { error } = await supabase
        .from('it_budget_rapprochement_groups')
        .update({ nom: nom.trim(), description: description ?? null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      // ON DELETE SET NULL côté ligne -> les lignes deviennent dégroupées
      const { error } = await supabase.from('it_budget_rapprochement_groups').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  /** Assigne plusieurs lignes à un groupe (ou les retire si groupId === null). */
  const assignLinesToGroup = useMutation({
    mutationFn: async ({ lineIds, groupId }: { lineIds: string[]; groupId: string | null }) => {
      if (lineIds.length === 0) return;
      const { error } = await supabase
        .from('it_budget_lines')
        .update({ rapprochement_group_id: groupId })
        .in('id', lineIds);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  return {
    groups: groupsQuery.data ?? [],
    isLoading: groupsQuery.isLoading,
    createGroup,
    renameGroup,
    deleteGroup,
    assignLinesToGroup,
  };
}
