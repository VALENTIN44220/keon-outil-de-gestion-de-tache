import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';

export type SupplierValidationRole = 'achat' | 'compta' | 'both' | 'none';

export function useSupplierValidationRole() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();

  return useQuery({
    queryKey: ['supplier-validation-role', user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<SupplierValidationRole> => {
      if (isAdmin) return 'both';

      const [{ data: achat }, { data: compta }] = await Promise.all([
        supabase.rpc('is_supplier_achat_member'),
        supabase.rpc('is_supplier_compta_member'),
      ]);

      if (achat && compta) return 'both';
      if (achat) return 'achat';
      if (compta) return 'compta';
      return 'none';
    },
  });
}
