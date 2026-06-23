import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Une embauche simulée : un profil, un nombre d'ETP, à partir d'un mois 'YYYY-MM'. */
export interface SimulatedHire {
  profil_code: string;
  nb_etp: number;
  start_ym: string;
}

export interface FdrHireScenario {
  id: string;
  nom: string;
  hires: SimulatedHire[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const KEY = ['fdr-hire-scenarios'];

export function useFdrHireScenarios() {
  const qc = useQueryClient();

  const list = useQuery<FdrHireScenario[]>({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fdr_hire_scenarios')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      type Row = Omit<FdrHireScenario, 'hires'> & { hires: unknown };
      return ((data ?? []) as Row[]).map((r) => ({
        ...r,
        hires: Array.isArray(r.hires) ? (r.hires as SimulatedHire[]) : [],
      }));
    },
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: async (payload: { nom: string; hires: SimulatedHire[] }) => {
      const { data, error } = await supabase
        .from('fdr_hire_scenarios')
        .insert({ nom: payload.nom, hires: payload.hires })
        .select()
        .single();
      if (error) throw error;
      return data as FdrHireScenario;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; nom?: string; hires?: SimulatedHire[] }) => {
      const { error } = await supabase
        .from('fdr_hire_scenarios')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fdr_hire_scenarios').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  return { scenarios: list.data ?? [], isLoading: list.isLoading, create, update, remove };
}
