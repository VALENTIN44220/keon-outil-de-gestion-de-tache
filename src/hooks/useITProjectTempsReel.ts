import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ITProjectTempsReel } from '@/types/itProject';

export interface ITProjectTempsReelAgg {
  rows: ITProjectTempsReel[];
  totalJours: number;
  totalCout: number;
  joursLucca: number;
  joursManuel: number;
  /** Agrégat par collaborateur (jours + coût cumulés). */
  parCollaborateur: { collaborateur: string; jours: number; cout: number }[];
}

export function useITProjectTempsReel(projectId: string | undefined) {
  return useQuery<ITProjectTempsReelAgg>({
    queryKey: ['it-project-temps-reel', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_it_project_temps_reel')
        .select('*')
        .eq('it_project_id', projectId!);
      if (error) throw error;
      const rows = (data ?? []) as ITProjectTempsReel[];

      let totalJours = 0;
      let totalCout = 0;
      let joursLucca = 0;
      let joursManuel = 0;
      const byCollab = new Map<string, { jours: number; cout: number }>();

      for (const r of rows) {
        const jours = Number(r.jours) || 0;
        const cout = Number(r.cout_rh) || 0;
        totalJours += jours;
        totalCout += cout;
        if (r.source === 'lucca') joursLucca += jours;
        else joursManuel += jours;
        const cur = byCollab.get(r.collaborateur) ?? { jours: 0, cout: 0 };
        cur.jours += jours;
        cur.cout += cout;
        byCollab.set(r.collaborateur, cur);
      }

      const parCollaborateur = Array.from(byCollab.entries())
        .map(([collaborateur, v]) => ({ collaborateur, ...v }))
        .sort((a, b) => b.jours - a.jours);

      return { rows, totalJours, totalCout, joursLucca, joursManuel, parCollaborateur };
    },
    staleTime: 30_000,
  });
}
