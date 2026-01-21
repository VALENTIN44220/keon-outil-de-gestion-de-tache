import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { useTeamHierarchy } from '@/hooks/useTeamHierarchy';

export type TaskScope = 'my_tasks' | 'department_tasks' | 'all_tasks';

interface ScopeOption {
  value: TaskScope;
  label: string;
}

interface FilterableProfile {
  id: string;
  display_name: string | null;
  department_id: string | null;
  department: string | null;
  company_id: string | null;
  company: string | null;
}

interface FilterableCompany {
  id: string;
  name: string;
}

interface FilterableDepartment {
  id: string;
  name: string;
  company_id: string | null;
}

export interface TaskScopeContext {
  // Current scope
  scope: TaskScope;
  setScope: (scope: TaskScope) => void;
  
  // Available scope options based on permissions
  availableScopes: ScopeOption[];
  
  // Filtered options for dropdowns based on current user's permissions
  availableProfiles: FilterableProfile[];
  availableCompanies: FilterableCompany[];
  availableDepartments: FilterableDepartment[];
  
  // Helper to get IDs for task filtering
  getAssigneeIdsForScope: () => string[];
  getDepartmentIdsForScope: () => string[];
  
  isLoading: boolean;
}

export function useTaskScope(): TaskScopeContext {
  const { profile: authProfile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const { effectivePermissions, isLoading: permissionsLoading } = useEffectivePermissions();
  const { subordinates, allMembers } = useTeamHierarchy();
  
  const profile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;
  
  const [scope, setScope] = useState<TaskScope>('my_tasks');
  const [allProfiles, setAllProfiles] = useState<FilterableProfile[]>([]);
  const [allCompanies, setAllCompanies] = useState<FilterableCompany[]>([]);
  const [allDepartments, setAllDepartments] = useState<FilterableDepartment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all data for filters
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      
      const [profilesRes, companiesRes, departmentsRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name, department_id, department, company_id, company'),
        supabase.from('companies').select('id, name'),
        supabase.from('departments').select('id, name, company_id'),
      ]);
      
      if (profilesRes.data) setAllProfiles(profilesRes.data);
      if (companiesRes.data) setAllCompanies(companiesRes.data);
      if (departmentsRes.data) setAllDepartments(departmentsRes.data);
      
      setIsLoading(false);
    };
    
    fetchData();
  }, []);

  // Available scopes based on permissions
  const availableScopes = useMemo<ScopeOption[]>(() => {
    const scopes: ScopeOption[] = [{ value: 'my_tasks', label: 'Mes tâches' }];
    
    // Managers can see department tasks
    if (effectivePermissions.can_view_subordinates_tasks || effectivePermissions.can_view_all_tasks) {
      scopes.push({ value: 'department_tasks', label: 'Tâches du service' });
    }
    
    // Admins/Directors can see all tasks
    if (effectivePermissions.can_view_all_tasks) {
      scopes.push({ value: 'all_tasks', label: 'Toutes les tâches' });
    }
    
    return scopes;
  }, [effectivePermissions]);

  // Reset scope if current scope is no longer available
  useEffect(() => {
    const isCurrentScopeAvailable = availableScopes.some(s => s.value === scope);
    if (!isCurrentScopeAvailable) {
      setScope('my_tasks');
    }
  }, [availableScopes, scope]);

  // Get subordinate IDs including self
  const myTeamIds = useMemo(() => {
    if (!profile?.id) return [];
    const ids = [profile.id];
    subordinates.forEach(sub => ids.push(sub.id));
    return ids;
  }, [profile?.id, subordinates]);

  // Filter profiles based on permissions
  const availableProfiles = useMemo<FilterableProfile[]>(() => {
    if (!profile?.id) return [];
    
    // Admin/Director: can see all
    if (effectivePermissions.can_view_all_tasks) {
      return allProfiles;
    }
    
    // Manager: can see self + subordinates (team members)
    if (effectivePermissions.can_view_subordinates_tasks) {
      return allProfiles.filter(p => myTeamIds.includes(p.id));
    }
    
    // Regular user: only self
    return allProfiles.filter(p => p.id === profile.id);
  }, [allProfiles, profile?.id, effectivePermissions, myTeamIds]);

  // Filter companies based on permissions
  const availableCompanies = useMemo<FilterableCompany[]>(() => {
    if (!profile) return [];
    
    // Admin/Director: can see all
    if (effectivePermissions.can_view_all_tasks) {
      return allCompanies;
    }
    
    // Others: only their company
    if (profile.company_id) {
      return allCompanies.filter(c => c.id === profile.company_id);
    }
    
    return [];
  }, [allCompanies, profile, effectivePermissions]);

  // Filter departments based on permissions
  const availableDepartments = useMemo<FilterableDepartment[]>(() => {
    if (!profile) return [];
    
    // Admin/Director: can see all
    if (effectivePermissions.can_view_all_tasks) {
      return allDepartments;
    }
    
    // Manager: their department only
    if (profile.department_id) {
      return allDepartments.filter(d => d.id === profile.department_id);
    }
    
    return [];
  }, [allDepartments, profile, effectivePermissions]);

  // Get assignee IDs for current scope
  const getAssigneeIdsForScope = useCallback((): string[] => {
    if (!profile?.id) return [];
    
    switch (scope) {
      case 'my_tasks':
        return [profile.id];
      case 'department_tasks':
        return myTeamIds;
      case 'all_tasks':
        return []; // Empty means no filter
      default:
        return [profile.id];
    }
  }, [scope, profile?.id, myTeamIds]);

  // Get department IDs for current scope
  const getDepartmentIdsForScope = useCallback((): string[] => {
    if (!profile?.department_id) return [];
    
    switch (scope) {
      case 'my_tasks':
        return [];
      case 'department_tasks':
        return [profile.department_id];
      case 'all_tasks':
        return []; // Empty means no filter
      default:
        return [];
    }
  }, [scope, profile?.department_id]);

  return {
    scope,
    setScope,
    availableScopes,
    availableProfiles,
    availableCompanies,
    availableDepartments,
    getAssigneeIdsForScope,
    getDepartmentIdsForScope,
    isLoading: isLoading || permissionsLoading,
  };
}
