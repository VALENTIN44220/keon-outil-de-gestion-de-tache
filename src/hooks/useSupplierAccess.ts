import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useSupplierAccess() {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [role, setRole] = useState<'achat' | 'compta' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAccess() {
      if (!user?.email) {
        setHasAccess(false);
        setRole(null);
        setIsLoading(false);
        return;
      }

      try {
        // Check if admin first
        const { data: adminData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (adminData) {
          setHasAccess(true);
          setRole('achat'); // Admin has full access
          setIsLoading(false);
          return;
        }

        // Check supplier permissions
        const { data, error } = await supabase
          .from('supplier_purchase_permissions')
          .select('role, is_active')
          .eq('email', user.email)
          .eq('is_active', true)
          .maybeSingle();

        if (error) {
          console.error('Error checking supplier access:', error);
          setHasAccess(false);
          setRole(null);
        } else if (data) {
          setHasAccess(true);
          setRole(data.role as 'achat' | 'compta');
        } else {
          setHasAccess(false);
          setRole(null);
        }
      } catch (error) {
        console.error('Error checking supplier access:', error);
        setHasAccess(false);
        setRole(null);
      } finally {
        setIsLoading(false);
      }
    }

    checkAccess();
  }, [user]);

  return { hasAccess, role, isLoading };
}
