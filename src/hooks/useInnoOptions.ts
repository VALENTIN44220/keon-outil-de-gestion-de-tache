import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useInnoCodeProjetOptions() {
  return useQuery({
    queryKey: ['inno-code-projet-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inno_code_projet_options')
        .select('*')
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      return data;
    },
  });
}

export function useInnoUsageOptions() {
  return useQuery({
    queryKey: ['inno-usage-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inno_usage_options')
        .select('*')
        .eq('is_active', true)
        .order('label');
      if (error) throw error;
      return data;
    },
  });
}

export function useInnoEtiquetteSuggestions() {
  return useQuery({
    queryKey: ['inno-etiquette-suggestions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inno_etiquette_suggestions')
        .select('*')
        .eq('is_active', true)
        .order('label');
      if (error) throw error;
      return data;
    },
  });
}
