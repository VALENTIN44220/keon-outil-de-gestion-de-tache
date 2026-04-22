import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EngageConstateRow {
  budget_line_id: string;
  engage: number;
  constate: number;
  nb_commandes: number;
  nb_factures: number;
}

export function useITBudgetEngageConstate(filters: { annee?: number; entite?: string }) {
  return useQuery({
    queryKey: ['it-budget-engage-constate', filters],
    queryFn: async () => {
      let q = (supabase as any)
        .from('v_it_budget_engage_constate')
        .select('budget_line_id, engage, constate, nb_commandes, nb_factures');
      if (filters.annee) q = q.eq('annee', filters.annee);
      if (filters.entite && filters.entite !== 'all') q = q.eq('entite', filters.entite);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as EngageConstateRow[];
      const totalEngage   = rows.reduce((s, r) => s + (Number(r.engage)   ?? 0), 0);
      const totalConstate = rows.reduce((s, r) => s + (Number(r.constate) ?? 0), 0);
      return { rows, totalEngage, totalConstate };
    },
  });
}
