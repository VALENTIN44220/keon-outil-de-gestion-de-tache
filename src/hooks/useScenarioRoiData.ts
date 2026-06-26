import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useITTjmReferentiel } from './useITTjmReferentiel';
import type { ITProjectRHHorsIT } from '@/types/itProject';

export interface ScenarioRoiData {
  /** map it_project_id → lignes RH hors IT (gains & build métier) */
  rhHorsITByProject: Record<string, ITProjectRHHorsIT[]>;
  /** map profil_code → TJM €/j */
  tjmMap: Record<string, number>;
}

/**
 * Charge en bloc les données nécessaires au ROI agrégé d'un scénario :
 * toutes les lignes `it_project_rh_hors_it` (gains/build métier de tous les
 * projets) + le référentiel TJM par profil.
 */
export function useScenarioRoiData() {
  const { data: tjmList = [], isLoading: tjmLoading } = useITTjmReferentiel();

  const rhQuery = useQuery<Record<string, ITProjectRHHorsIT[]>>({
    queryKey: ['scenario-roi-rh-hors-it'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('it_project_rh_hors_it')
        .select('*');
      if (error) throw error;
      const byProject: Record<string, ITProjectRHHorsIT[]> = {};
      for (const r of (data ?? []) as ITProjectRHHorsIT[]) {
        (byProject[r.it_project_id] ??= []).push(r);
      }
      return byProject;
    },
    staleTime: 30_000,
  });

  const tjmMap: Record<string, number> = Object.fromEntries(
    tjmList.map((t) => [t.profil_code, t.tjm_eur]),
  );

  return {
    data: { rhHorsITByProject: rhQuery.data ?? {}, tjmMap } as ScenarioRoiData,
    isLoading: tjmLoading || rhQuery.isLoading,
  };
}
