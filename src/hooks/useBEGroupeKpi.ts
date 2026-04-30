import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

export interface BEGroupeKPI {
  /** Prefixe 5 chars (ex: 'EVINZ'). */
  code_groupe: string;
  /** Projet BE rattache (deduit via be_affaires). NULL si aucune affaire BE n'a ce prefixe. */
  be_project_id: string | null;
  ca_engage_brut: number;
  ca_constate_brut: number;
  cogs_engage_brut: number;
  cogs_constate_brut: number;
  marge_constatee_brut: number;
  marge_brute_brut: number;
  marge_directe_brut: number;
  nb_commandes: number;
  nb_factures: number;
  nb_activites_divalto: number;
  jours_budgetes: number;
  cout_rh_budgete: number;
  heures_declarees: number;
  jours_declares: number;
  cout_rh_declare: number;
  nb_collaborateurs: number;
}

/**
 * KPIs par "affaire globale" (prefixe 5 chars du code_affaire).
 * Pour un projet donne, retourne les groupes correspondants.
 */
export function useBEGroupeKpis(projectId: string | undefined) {
  const query = useQuery({
    queryKey: ['be-groupe-kpis', projectId],
    queryFn: async (): Promise<BEGroupeKPI[]> => {
      if (!projectId) return [];
      const { data, error } = await sb
        .from('v_be_groupe_kpi')
        .select('*')
        .eq('be_project_id', projectId);
      if (error) throw error;
      return (data as BEGroupeKPI[]) ?? [];
    },
    enabled: !!projectId,
  });

  const byCode = useMemo(() => {
    const m = new Map<string, BEGroupeKPI>();
    for (const k of query.data ?? []) m.set(k.code_groupe, k);
    return m;
  }, [query.data]);

  return {
    groupes: query.data ?? [],
    byCode,
    isLoading: query.isLoading,
  };
}
