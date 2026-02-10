import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { supabase } from '@/integrations/supabase/client';
import type { 
  EffectivePermissions, 
  UserPermissionOverride, 
  AllPermissionKeys,
  ScreenPermissionKey,
  FeaturePermissionKey 
} from '@/types/permissions';
import type { PermissionProfile } from '@/types/admin';

const defaultPermissions: EffectivePermissions = {
  can_access_dashboard: true,
  can_access_requests: true,
  can_access_templates: true,
  can_access_workload: true,
  can_access_calendar: true,
  can_access_projects: true,
  can_access_team: true,
  can_access_suppliers: false,
  can_manage_users: false,
  can_manage_templates: false,
  can_view_own_tasks: true,
  can_manage_own_tasks: true,
  can_view_subordinates_tasks: false,
  can_manage_subordinates_tasks: false,
  can_assign_to_subordinates: false,
  can_view_all_tasks: false,
  can_manage_all_tasks: false,
  can_assign_to_all: false,
  can_view_be_projects: false,
  can_create_be_projects: false,
  can_edit_be_projects: false,
  can_delete_be_projects: false,
  visibleProcessTemplateIds: [],
};

export function useEffectivePermissions() {
  const { profile: authProfile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  
  // Use simulated profile if in simulation mode, otherwise use auth profile
  const profile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;
  
  const [permissionProfile, setPermissionProfile] = useState<PermissionProfile | null>(null);
  const [userOverrides, setUserOverrides] = useState<UserPermissionOverride | null>(null);
  const [profileProcessTemplates, setProfileProcessTemplates] = useState<string[]>([]);
  const [userProcessOverrides, setUserProcessOverrides] = useState<{ process_template_id: string; is_visible: boolean }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPermissions() {
      if (!profile?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Fetch permission profile
        if (profile.permission_profile_id) {
          const { data: profileData } = await supabase
            .from('permission_profiles')
            .select('*')
            .eq('id', profile.permission_profile_id)
            .single();

          if (profileData) {
            setPermissionProfile(profileData as unknown as PermissionProfile);
          }

          // Fetch process templates visible for this profile
          const { data: processTemplates } = await supabase
            .from('permission_profile_process_templates')
            .select('process_template_id')
            .eq('permission_profile_id', profile.permission_profile_id);

          if (processTemplates) {
            setProfileProcessTemplates(processTemplates.map(pt => pt.process_template_id));
          }
        }

        // Fetch user-specific overrides
        const { data: overrides } = await supabase
          .from('user_permission_overrides')
          .select('*')
          .eq('user_id', profile.id)
          .single();

        if (overrides) {
          setUserOverrides(overrides as unknown as UserPermissionOverride);
        }

        // Fetch user process template overrides
        const { data: processOverrides } = await supabase
          .from('user_process_template_overrides')
          .select('process_template_id, is_visible')
          .eq('user_id', profile.id);

        if (processOverrides) {
          setUserProcessOverrides(processOverrides);
        }
      } catch (error) {
        console.error('Error fetching permissions:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPermissions();
  }, [profile?.id, profile?.permission_profile_id, isSimulating]);

  // Compute effective permissions by merging profile defaults with user overrides
  const effectivePermissions = useMemo<EffectivePermissions>(() => {
    const result = { ...defaultPermissions };

    // Apply permission profile defaults
    if (permissionProfile) {
      const screenKeys: ScreenPermissionKey[] = [
        'can_access_dashboard', 'can_access_requests', 'can_access_templates',
        'can_access_workload', 'can_access_calendar', 'can_access_projects',
        'can_access_team'
      ];

      const featureKeys: FeaturePermissionKey[] = [
        'can_manage_users', 'can_manage_templates', 'can_view_own_tasks',
        'can_manage_own_tasks', 'can_view_subordinates_tasks', 'can_manage_subordinates_tasks',
        'can_assign_to_subordinates', 'can_view_all_tasks', 'can_manage_all_tasks',
        'can_assign_to_all', 'can_view_be_projects', 'can_create_be_projects',
        'can_edit_be_projects', 'can_delete_be_projects'
      ];

      // Apply screen permissions from profile
      screenKeys.forEach(key => {
        const value = (permissionProfile as any)[key];
        if (value !== undefined && value !== null) {
          result[key] = value;
        }
      });

      // Apply feature permissions from profile
      featureKeys.forEach(key => {
        const value = (permissionProfile as any)[key];
        if (value !== undefined && value !== null) {
          result[key] = value;
        }
      });
    }

    // Apply user-specific overrides (null = use profile default)
    if (userOverrides) {
      const allKeys: AllPermissionKeys[] = [
        'can_access_dashboard', 'can_access_requests', 'can_access_templates',
        'can_access_workload', 'can_access_calendar', 'can_access_projects',
        'can_access_team',
        'can_manage_users', 'can_manage_templates', 'can_view_own_tasks',
        'can_manage_own_tasks', 'can_view_subordinates_tasks', 'can_manage_subordinates_tasks',
        'can_assign_to_subordinates', 'can_view_all_tasks', 'can_manage_all_tasks',
        'can_assign_to_all', 'can_view_be_projects', 'can_create_be_projects',
        'can_edit_be_projects', 'can_delete_be_projects'
      ];

      allKeys.forEach(key => {
        const overrideValue = userOverrides[key];
        if (overrideValue !== null && overrideValue !== undefined) {
          result[key] = overrideValue;
        }
      });
    }

    // Compute visible process templates
    // Start with profile-level visibility
    const visibleSet = new Set<string>(profileProcessTemplates);

    // Apply user-specific overrides (ensure it's an array)
    if (Array.isArray(userProcessOverrides)) {
      userProcessOverrides.forEach(override => {
        if (override.is_visible) {
          visibleSet.add(override.process_template_id);
        } else {
          visibleSet.delete(override.process_template_id);
        }
      });
    }

    result.visibleProcessTemplateIds = Array.from(visibleSet);

    return result;
  }, [permissionProfile, userOverrides, profileProcessTemplates, userProcessOverrides]);

  // Helper function to check screen access
  const canAccessScreen = (screenKey: ScreenPermissionKey): boolean => {
    return effectivePermissions[screenKey];
  };

  // Helper function to check if a process template is visible
  const canViewProcessTemplate = (processTemplateId: string): boolean => {
    // If no restrictions configured (empty list), allow all
    if (profileProcessTemplates.length === 0 && userProcessOverrides.length === 0) {
      return true;
    }
    return effectivePermissions.visibleProcessTemplateIds.includes(processTemplateId);
  };

  return {
    effectivePermissions,
    permissionProfile,
    userOverrides,
    isLoading,
    canAccessScreen,
    canViewProcessTemplate,
  };
}
