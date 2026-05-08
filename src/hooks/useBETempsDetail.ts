import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

export interface BETempsDetailRow {
  /** Premier jour du mois (YYYY-MM-01). */
  mois: string;
  code_affaire: string;
  /** NULL si la saisie Lucca pointe sur un code_affaire pas encore importe dans be_affaires. */
  be_affaire_id: string | null;
  affaire_libelle: string | null;
  be_project_id: string | null;
  user_id: string | null;
  user_display_name: string | null;
  /** charge_affaires | developpeur | ingenieur_etudes | ingenieur_realisation | projeteur | autre */
  poste: string;
  heures: number;
  jours: number;
  cout_rh: number;
  nb_saisies: number;
}

/**
 * Detail mensuel des saisies de temps Lucca, agrege par
 * (mois x code_affaire x user x poste).
 *
 * - Si `beProjectId` est fourni : limite aux affaires de ce projet.
 * - Si non fourni : retourne tout (vue cross-projets).
 */
export function useBETempsDetail(beProjectId?: string | null | undefined) {
  return useQuery({
    queryKey: ['be-temps-detail', beProjectId ?? 'all'],
    queryFn: async (): Promise<BETempsDetailRow[]> => {
      let q = sb
        .from('v_be_temps_detail_mensuel')
        .select('*')
        .order('mois', { ascending: false })
        .order('code_affaire', { ascending: true });

      if (beProjectId) q = q.eq('be_project_id', beProjectId);

      const { data, error } = await q;
      if (error) throw error;
      return (data as BETempsDetailRow[]) ?? [];
    },
    enabled: beProjectId === undefined ? true : !!beProjectId,
  });
}
