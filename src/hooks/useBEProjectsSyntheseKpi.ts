import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

export interface BEProjectSyntheseKPI {
  be_project_id: string;
  code_projet: string;
  nom_projet: string | null;
  status: string;
  nb_affaires: number;
  ca_engage_brut: number;
  ca_constate_brut: number;
  cogs_engage_brut: number;
  cogs_constate_brut: number;
  marge_constatee_brut: number;
  marge_brute_brut: number;
  marge_directe_brut: number;
  nb_commandes: number;
  nb_factures: number;
  jours_budgetes: number;
  cout_rh_budgete: number;
  jours_planifies: number;
  cout_rh_planifie: number;
  jours_declares: number;
  cout_rh_declare: number;
}

/**
 * Synthese KPI par projet BE (CA + COGS + Marge + Temps + Cout RH).
 * Utilisee par le dashboard /projects en variant='be'.
 */
export function useBEProjectsSyntheseKpi() {
  return useQuery({
    queryKey: ['be-projects-synthese-kpi'],
    queryFn: async (): Promise<BEProjectSyntheseKPI[]> => {
      const { data, error } = await sb
        .from('v_be_project_synthese_kpi')
        .select('*');
      if (error) throw error;
      return (data as BEProjectSyntheseKPI[]) ?? [];
    },
  });
}
