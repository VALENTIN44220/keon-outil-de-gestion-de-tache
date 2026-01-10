import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Company, Department, JobTitle, HierarchyLevel, PermissionProfile } from '@/types/admin';

export function useAdminData() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [hierarchyLevels, setHierarchyLevels] = useState<HierarchyLevel[]>([]);
  const [permissionProfiles, setPermissionProfiles] = useState<PermissionProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [companiesRes, departmentsRes, jobTitlesRes, levelsRes, profilesRes] = await Promise.all([
        supabase.from('companies').select('*').order('name'),
        supabase.from('departments').select('*, company:companies(*)').order('name'),
        supabase.from('job_titles').select('*, department:departments(*, company:companies(*))').order('name'),
        supabase.from('hierarchy_levels').select('*').order('level'),
        supabase.from('permission_profiles').select('*').order('name'),
      ]);

      if (companiesRes.data) setCompanies(companiesRes.data);
      if (departmentsRes.data) setDepartments(departmentsRes.data);
      if (jobTitlesRes.data) setJobTitles(jobTitlesRes.data);
      if (levelsRes.data) setHierarchyLevels(levelsRes.data);
      if (profilesRes.data) setPermissionProfiles(profilesRes.data);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Companies CRUD
  const addCompany = async (name: string, description?: string) => {
    const { data, error } = await supabase
      .from('companies')
      .insert({ name, description })
      .select()
      .single();
    if (error) throw error;
    setCompanies(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    return data;
  };

  const deleteCompany = async (id: string) => {
    const { error } = await supabase.from('companies').delete().eq('id', id);
    if (error) throw error;
    setCompanies(prev => prev.filter(c => c.id !== id));
  };

  // Departments CRUD
  const addDepartment = async (name: string, company_id?: string, description?: string) => {
    const { data, error } = await supabase
      .from('departments')
      .insert({ name, company_id, description })
      .select('*, company:companies(*)')
      .single();
    if (error) throw error;
    setDepartments(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    return data;
  };

  const deleteDepartment = async (id: string) => {
    const { error } = await supabase.from('departments').delete().eq('id', id);
    if (error) throw error;
    setDepartments(prev => prev.filter(d => d.id !== id));
  };

  // Job Titles CRUD
  const addJobTitle = async (name: string, department_id?: string, description?: string) => {
    const { data, error } = await supabase
      .from('job_titles')
      .insert({ name, department_id, description })
      .select('*, department:departments(*, company:companies(*))')
      .single();
    if (error) throw error;
    setJobTitles(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    return data;
  };

  const deleteJobTitle = async (id: string) => {
    const { error } = await supabase.from('job_titles').delete().eq('id', id);
    if (error) throw error;
    setJobTitles(prev => prev.filter(j => j.id !== id));
  };

  // Hierarchy Levels CRUD
  const addHierarchyLevel = async (name: string, level: number, description?: string) => {
    const { data, error } = await supabase
      .from('hierarchy_levels')
      .insert({ name, level, description })
      .select()
      .single();
    if (error) throw error;
    setHierarchyLevels(prev => [...prev, data].sort((a, b) => a.level - b.level));
    return data;
  };

  const deleteHierarchyLevel = async (id: string) => {
    const { error } = await supabase.from('hierarchy_levels').delete().eq('id', id);
    if (error) throw error;
    setHierarchyLevels(prev => prev.filter(h => h.id !== id));
  };

  // Permission Profiles CRUD
  const addPermissionProfile = async (profile: Omit<PermissionProfile, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('permission_profiles')
      .insert(profile)
      .select()
      .single();
    if (error) throw error;
    setPermissionProfiles(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    return data;
  };

  const deletePermissionProfile = async (id: string) => {
    const { error } = await supabase.from('permission_profiles').delete().eq('id', id);
    if (error) throw error;
    setPermissionProfiles(prev => prev.filter(p => p.id !== id));
  };

  return {
    companies,
    departments,
    jobTitles,
    hierarchyLevels,
    permissionProfiles,
    isLoading,
    refetch: fetchAll,
    addCompany,
    deleteCompany,
    addDepartment,
    deleteDepartment,
    addJobTitle,
    deleteJobTitle,
    addHierarchyLevel,
    deleteHierarchyLevel,
    addPermissionProfile,
    deletePermissionProfile,
  };
}
