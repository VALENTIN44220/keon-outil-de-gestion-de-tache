import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PermissionProfile, HierarchyLevel } from '@/types/admin';

export function useUserPermissions() {
  const { profile } = useAuth();
  const [permissionProfile, setPermissionProfile] = useState<PermissionProfile | null>(null);
  const [hierarchyLevel, setHierarchyLevel] = useState<HierarchyLevel | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!profile) {
        setPermissionProfile(null);
        setHierarchyLevel(null);
        setIsLoading(false);
        return;
      }

      try {
        // Fetch permission profile
        if (profile.permission_profile_id) {
          const { data: permData } = await supabase
            .from('permission_profiles')
            .select('*')
            .eq('id', profile.permission_profile_id)
            .single();
          
          if (permData) {
            setPermissionProfile(permData as PermissionProfile);
          }
        }

        // Fetch hierarchy level
        if (profile.hierarchy_level_id) {
          const { data: hierData } = await supabase
            .from('hierarchy_levels')
            .select('*')
            .eq('id', profile.hierarchy_level_id)
            .single();
          
          if (hierData) {
            setHierarchyLevel(hierData);
          }
        }
      } catch (error) {
        console.error('Error fetching user permissions:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [profile]);

  // Determine if user can assign to team members
  const canAssignToTeam = permissionProfile?.can_assign_to_subordinates || 
                          permissionProfile?.can_assign_to_all || 
                          false;
  
  // Check if user has management rights
  const isManager = canAssignToTeam || 
                    permissionProfile?.can_manage_subordinates_tasks ||
                    permissionProfile?.can_view_subordinates_tasks ||
                    false;

  return {
    permissionProfile,
    hierarchyLevel,
    isLoading,
    canAssignToTeam,
    isManager,
  };
}
