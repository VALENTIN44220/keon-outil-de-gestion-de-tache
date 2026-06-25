import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LuccaCodeSite {
  code_site: string;
  nb_saisies: number;
  jours: number;
}

/**
 * Codes d'imputation Lucca candidats pour le rapprochement IT.
 * Les temps IT/structure sont déclarés sous des codes préfixés S ou R
 * (ex : SKEON000, SDEVE000, RGENE000) — voir v_lucca_code_sites.
 */
export function useLuccaCodeSites() {
  return useQuery<LuccaCodeSite[]>({
    queryKey: ['lucca-code-sites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_lucca_code_sites')
        .select('code_site, nb_saisies, jours')
        .or('code_site.ilike.S%,code_site.ilike.R%')
        .order('jours', { ascending: false });
      if (error) throw error;
      return (data ?? []) as LuccaCodeSite[];
    },
    staleTime: 5 * 60_000,
  });
}
