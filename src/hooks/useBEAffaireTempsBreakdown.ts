import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { BEPoste } from '@/types/beTemps';

const sb = supabase as any;

export interface BETempsParUser {
  be_affaire_id: string;
  code_affaire: string;
  user_id: string | null;
  id_lucca: number | null;
  display_name: string | null;
  be_poste: BEPoste | null;
  nb_saisies: number;
  heures: number;
  jours: number;
  cout_rh: number;
  premiere_saisie: string | null;
  derniere_saisie: string | null;
}

export interface BETempsParPoste {
  be_affaire_id: string;
  code_affaire: string;
  /** Le poste BE ou 'non_assigne' pour les profils Lucca sans be_poste. */
  poste: BEPoste | 'non_assigne';
  nb_collaborateurs: number;
  nb_saisies: number;
  heures: number;
  jours: number;
  cout_rh: number;
}

/**
 * Detail du temps declare sur une affaire :
 *   - parUser : 1 ligne par collaborateur (qui a passe combien)
 *   - parPoste : 1 ligne par poste BE (regroupement)
 */
export function useBEAffaireTempsBreakdown(affaireId: string | undefined) {
  const parUser = useQuery({
    queryKey: ['be-affaire-temps-par-user', affaireId],
    queryFn: async (): Promise<BETempsParUser[]> => {
      if (!affaireId) return [];
      const { data, error } = await sb
        .from('v_be_affaire_temps_par_user')
        .select('*')
        .eq('be_affaire_id', affaireId)
        .order('jours', { ascending: false });
      if (error) throw error;
      return (data as BETempsParUser[]) ?? [];
    },
    enabled: !!affaireId,
  });

  const parPoste = useQuery({
    queryKey: ['be-affaire-temps-par-poste', affaireId],
    queryFn: async (): Promise<BETempsParPoste[]> => {
      if (!affaireId) return [];
      const { data, error } = await sb
        .from('v_be_affaire_temps_par_poste')
        .select('*')
        .eq('be_affaire_id', affaireId)
        .order('jours', { ascending: false });
      if (error) throw error;
      return (data as BETempsParPoste[]) ?? [];
    },
    enabled: !!affaireId,
  });

  return {
    parUser: parUser.data ?? [],
    parPoste: parPoste.data ?? [],
    isLoading: parUser.isLoading || parPoste.isLoading,
  };
}
