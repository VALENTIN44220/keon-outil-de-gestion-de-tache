import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

export interface SpvAffaireTempsKpi {
  code_affaire: string;
  heures_declarees: number;
  jours_declares: number;
  cout_rh_declare: number;
  nb_collaborateurs: number;
  premiere_saisie: string | null;
  derniere_saisie: string | null;
}

export interface SpvAffaireTempsUser {
  code_affaire: string;
  user_id: string | null;
  display_name: string | null;
  job_title: string | null;
  taux_horaire: number;
  heures: number;
  jours: number;
  cout_rh: number;
}

/**
 * Suivi des temps SPV — affaires dont le code commence par 'M'.
 * Source : vues v_spv_affaire_temps_kpi / v_spv_affaire_temps_par_user
 * (alimentées par lucca_saisie_temps, tous salariés confondus).
 */
export function useSpvAffairesTemps() {
  return useQuery({
    queryKey: ['spv-affaires-temps-kpi'],
    queryFn: async (): Promise<SpvAffaireTempsKpi[]> => {
      const { data, error } = await sb
        .from('v_spv_affaire_temps_kpi')
        .select('*')
        .order('heures_declarees', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SpvAffaireTempsKpi[];
    },
  });
}

/** Détail par collaborateur pour une affaire M donnée. */
export function useSpvAffaireTempsByUser(codeAffaire: string | null) {
  return useQuery({
    queryKey: ['spv-affaire-temps-user', codeAffaire],
    enabled: !!codeAffaire,
    queryFn: async (): Promise<SpvAffaireTempsUser[]> => {
      const { data, error } = await sb
        .from('v_spv_affaire_temps_par_user')
        .select('*')
        .eq('code_affaire', codeAffaire)
        .order('heures', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SpvAffaireTempsUser[];
    },
  });
}
