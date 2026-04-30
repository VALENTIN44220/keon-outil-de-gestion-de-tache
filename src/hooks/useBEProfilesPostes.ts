import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { BEPoste } from '@/types/beTemps';

const sb = supabase as any;

export interface BEProfileWithPoste {
  id: string;
  display_name: string;
  job_title: string | null;
  department: string | null;
  id_lucca: string | null;
  status: string;
  be_poste: BEPoste | null;
  /** Saisies de temps Lucca rattachees (pour aider a prioriser ceux qui en ont). */
  nb_saisies?: number;
  heures_total?: number;
}

/** Liste des profils avec leur be_poste, enrichi du volume de saisies Lucca. */
export function useBEProfilesPostes() {
  return useQuery({
    queryKey: ['be-profiles-postes'],
    queryFn: async (): Promise<BEProfileWithPoste[]> => {
      // 1. Profils actifs
      const { data: profiles, error: pe } = await sb
        .from('profiles')
        .select('id,display_name,job_title,department,id_lucca,status,be_poste')
        .eq('status', 'active')
        .order('display_name');
      if (pe) throw pe;

      // 2. Aggreger les saisies par user_id (pour info)
      const { data: saisies, error: se } = await sb
        .from('lucca_saisie_temps')
        .select('user_id,duree_heures');
      if (se) throw se;

      const aggByUser = new Map<string, { nb: number; h: number }>();
      for (const s of (saisies ?? []) as { user_id: string | null; duree_heures: number }[]) {
        if (!s.user_id) continue;
        const cur = aggByUser.get(s.user_id) ?? { nb: 0, h: 0 };
        cur.nb += 1;
        cur.h += Number(s.duree_heures) || 0;
        aggByUser.set(s.user_id, cur);
      }

      return ((profiles ?? []) as BEProfileWithPoste[]).map((p) => ({
        ...p,
        nb_saisies: aggByUser.get(p.id)?.nb ?? 0,
        heures_total: aggByUser.get(p.id)?.h ?? 0,
      }));
    },
  });
}

/** Mutation : assigne / change / retire un be_poste pour un profil. */
export function useUpdateProfileBEPoste() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ profileId, bePoste }: { profileId: string; bePoste: BEPoste | null }) => {
      const { error } = await sb
        .from('profiles')
        .update({ be_poste: bePoste })
        .eq('id', profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['be-profiles-postes'] });
      // Les KPIs RH dependent du be_poste -> invalider tout
      qc.invalidateQueries({ queryKey: ['be-affaire-temps-kpi'] });
      qc.invalidateQueries({ queryKey: ['be-affaire-temps-par-user'] });
      qc.invalidateQueries({ queryKey: ['be-affaire-temps-par-poste'] });
      qc.invalidateQueries({ queryKey: ['be-projects-synthese-kpi'] });
      qc.invalidateQueries({ queryKey: ['be-affaires-kpis'] });
      qc.invalidateQueries({ queryKey: ['be-affaire-kpi-period'] });
    },
  });
}
