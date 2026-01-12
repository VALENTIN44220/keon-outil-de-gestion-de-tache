import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from './useUserRole';

export function useTemplatePermissions() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [canManageTemplates, setCanManageTemplates] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPermissions() {
      if (!user) {
        setCanManageTemplates(false);
        setIsLoading(false);
        return;
      }

      // Admins can always manage templates
      if (isAdmin) {
        setCanManageTemplates(true);
        setIsLoading(false);
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select(`
            permission_profile_id,
            permission_profiles:permission_profile_id (
              can_manage_templates
            )
          `)
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        
        const permissionProfile = profile?.permission_profiles as { can_manage_templates: boolean } | null;
        setCanManageTemplates(permissionProfile?.can_manage_templates ?? false);
      } catch (error) {
        console.error('Error fetching template permissions:', error);
        setCanManageTemplates(false);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPermissions();
  }, [user, isAdmin]);

  return { canManageTemplates, isLoading };
}
