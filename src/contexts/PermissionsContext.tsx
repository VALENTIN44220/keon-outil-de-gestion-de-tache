/**
 * PermissionsContext
 * Fetches permissions ONCE globally so that every call to useEffectivePermissions()
 * reads shared state instead of issuing its own Supabase queries.
 */
import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import type {
  EffectivePermissions,
  UserPermissionOverride,
  AllPermissionKeys,
  ScreenPermissionKey,
  FeaturePermissionKey,
} from '@/types/permissions';
import { SCREEN_PERMISSIONS, FEATURE_PERMISSIONS } from '@/types/permissions';
import type { PermissionProfile } from '@/types/admin';

const DEFAULT_PERMISSIONS: EffectivePermissions = {
  can_access_dashboard: true,
  can_access_requests: true,
  can_access_tasks: true,
  can_access_templates: true,
  can_access_workload: true,
  can_access_calendar: true,
  can_access_projects: true,
  can_access_it_projects: false,
  can_access_team: true,
  can_access_suppliers: false,
  can_access_process_tracking: true,
  can_access_settings: false,
  can_access_analytics: false,
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
  can_view_it_projects: false,
  can_create_it_projects: false,
  can_edit_it_projects: false,
  can_delete_it_projects: false,
  can_view_suppliers: false,
  can_create_suppliers: false,
  can_edit_suppliers: false,
  can_delete_suppliers: false,
  visibleProcessTemplateIds: [],
};

export interface PermissionsContextValue {
  effectivePermissions: EffectivePermissions;
  permissionProfile: PermissionProfile | null;
  userOverrides: UserPermissionOverride | null;
  profileProcessTemplates: string[];
  userProcessOverrides: { process_template_id: string; is_visible: boolean }[];
  isLoading: boolean;
  canAccessScreen: (key: ScreenPermissionKey) => boolean;
  canViewProcessTemplate: (id: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { profile: authProfile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();

  const profile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;

  const [permissionProfile, setPermissionProfile] = useState<PermissionProfile | null>(null);
  const [userOverrides, setUserOverrides] = useState<UserPermissionOverride | null>(null);
  const [profileProcessTemplates, setProfileProcessTemplates] = useState<string[]>([]);
  const [userProcessOverrides, setUserProcessOverrides] = useState<{ process_template_id: string; is_visible: boolean }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPermissions() {
      if (!profile?.id) {
        setPermissionProfile(null);
        setUserOverrides(null);
        setProfileProcessTemplates([]);
        setUserProcessOverrides([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const [overridesRes, procOverridesRes] = await Promise.all([
          supabase.from('user_permission_overrides').select('*').eq('user_id', profile.id).maybeSingle(),
          supabase.from('user_process_template_overrides').select('process_template_id, is_visible').eq('user_id', profile.id),
        ]);

        setUserOverrides(overridesRes.data ? overridesRes.data as unknown as UserPermissionOverride : null);
        setUserProcessOverrides(procOverridesRes.data ?? []);

        if (profile.permission_profile_id) {
          const [profileRes, procTemplatesRes] = await Promise.all([
            supabase.from('permission_profiles').select('*').eq('id', profile.permission_profile_id).single(),
            supabase.from('permission_profile_process_templates').select('process_template_id').eq('permission_profile_id', profile.permission_profile_id),
          ]);

          setPermissionProfile(profileRes.data ? profileRes.data as unknown as PermissionProfile : null);
          setProfileProcessTemplates(procTemplatesRes.data?.map(pt => pt.process_template_id) ?? []);
        } else {
          setPermissionProfile(null);
          setProfileProcessTemplates([]);
        }
      } catch (error) {
        console.error('[PermissionsContext] Error fetching permissions:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPermissions();
  }, [profile?.id, profile?.permission_profile_id, isSimulating]);

  const effectivePermissions = useMemo<EffectivePermissions>(() => {
    const result = { ...DEFAULT_PERMISSIONS };

    if (permissionProfile) {
      const raw = permissionProfile as Record<string, unknown>;
      (SCREEN_PERMISSIONS as readonly ScreenPermissionKey[]).forEach(key => {
        const v = raw[key];
        if (v !== undefined && v !== null) result[key] = v as boolean;
      });
      (FEATURE_PERMISSIONS as readonly FeaturePermissionKey[]).forEach(key => {
        const v = raw[key];
        if (v !== undefined && v !== null) result[key] = v as boolean;
      });
      // Ancienne base sans colonne : l’écran IT suivait implicitement Projets + Voir IT.
      if (raw.can_access_it_projects == null) {
        result.can_access_it_projects = Boolean(raw.can_access_projects) && Boolean(raw.can_view_it_projects);
      }
    }

    if (userOverrides) {
      ([...SCREEN_PERMISSIONS, ...FEATURE_PERMISSIONS] as AllPermissionKeys[]).forEach(key => {
        const v = userOverrides[key];
        if (v !== null && v !== undefined) result[key] = v;
      });
    }

    const visibleSet = new Set<string>(profileProcessTemplates);
    userProcessOverrides.forEach(o => {
      if (o.is_visible) visibleSet.add(o.process_template_id);
      else visibleSet.delete(o.process_template_id);
    });
    result.visibleProcessTemplateIds = Array.from(visibleSet);

    return result;
  }, [permissionProfile, userOverrides, profileProcessTemplates, userProcessOverrides]);

  const canAccessScreen = (key: ScreenPermissionKey) => effectivePermissions[key];

  const canViewProcessTemplate = (id: string) => {
    if (profileProcessTemplates.length === 0 && userProcessOverrides.length === 0) return true;
    return effectivePermissions.visibleProcessTemplateIds.includes(id);
  };

  const value = useMemo<PermissionsContextValue>(() => ({
    effectivePermissions,
    permissionProfile,
    userOverrides,
    profileProcessTemplates,
    userProcessOverrides,
    isLoading,
    canAccessScreen,
    canViewProcessTemplate,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [effectivePermissions, permissionProfile, userOverrides, profileProcessTemplates, userProcessOverrides, isLoading]);

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissionsContext(): PermissionsContextValue {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error('usePermissionsContext must be used within <PermissionsProvider>');
  return ctx;
}
