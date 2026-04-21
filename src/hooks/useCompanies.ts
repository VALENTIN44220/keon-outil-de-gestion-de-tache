import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Company {
  id: string;
  name: string;
}

/**
 * Liste ordonnée des entités (public.companies).
 * Utilisée partout où on veut aligner les "entités" saisies en texte libre
 * sur le référentiel canonique (picker dropdown).
 */
export function useCompanies() {
  return useQuery({
    queryKey: ['companies-list'],
    queryFn: async (): Promise<Company[]> => {
      const { data, error } = await supabase.from('companies').select('id, name').order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Company[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

