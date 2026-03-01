import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SupplierPermissions {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export function useSupplierAccess() {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [role, setRole] = useState<'achat' | 'compta' | null>(null);
  const [supplierPermissions, setSupplierPermissions] = useState<SupplierPermissions>({
    canView: false, canCreate: false, canEdit: false, canDelete: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAccess() {
      if (!user?.email) {
        setHasAccess(false);
        setRole(null);
        setSupplierPermissions({ canView: false, canCreate: false, canEdit: false, canDelete: false });
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
          setRole('achat');
          setSupplierPermissions({ canView: true, canCreate: true, canEdit: true, canDelete: true });
          setIsLoading(false);
          return;
        }

        // Check permission profile + user overrides for granular supplier permissions
        const { data: profileAccess } = await supabase
          .from('profiles')
          .select(`
            permission_profile_id,
            permission_profiles!inner(can_view_suppliers, can_create_suppliers, can_edit_suppliers, can_delete_suppliers, can_access_suppliers),
            user_permission_overrides(can_view_suppliers, can_create_suppliers, can_edit_suppliers, can_delete_suppliers, can_access_suppliers)
          `)
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileAccess) {
          const pp = (profileAccess as any).permission_profiles;
          const uo = (profileAccess as any).user_permission_overrides?.[0];

          const canView = uo?.can_view_suppliers ?? pp?.can_view_suppliers ?? false;
          const canCreate = uo?.can_create_suppliers ?? pp?.can_create_suppliers ?? false;
          const canEdit = uo?.can_edit_suppliers ?? pp?.can_edit_suppliers ?? false;
          const canDelete = uo?.can_delete_suppliers ?? pp?.can_delete_suppliers ?? false;
          // Also check legacy can_access_suppliers for backward compat
          const legacyAccess = uo?.can_access_suppliers ?? pp?.can_access_suppliers ?? false;

          if (canView || legacyAccess) {
            setHasAccess(true);
            setRole(canEdit ? 'achat' : 'compta');
            setSupplierPermissions({ canView: canView || legacyAccess, canCreate, canEdit, canDelete });
            setIsLoading(false);
            return;
          }
        }

        // Check direct supplier permissions (supplier_purchase_permissions table)
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
          const r = data.role as 'achat' | 'compta';
          setRole(r);
          setSupplierPermissions({
            canView: true,
            canCreate: r === 'achat',
            canEdit: r === 'achat',
            canDelete: r === 'achat',
          });
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

  return { hasAccess, role, supplierPermissions, isLoading };
}
