import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type SupplierWaitingApprovalRow = {
  id: string;
  line_index: string;
  tiers: string | null;
  nomfournisseur: string | null;
  entite: string | null;
  famille: string | null;
  siret: string | null;
  created_at: string | null;
};

export function useSupplierWaitingApprovalList(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['supplier-waiting-approval'],
    enabled: options?.enabled ?? true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_waiting_approval')
        .select('id,line_index,tiers,nomfournisseur,entite,famille,siret,created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as SupplierWaitingApprovalRow[];
    },
  });
}
