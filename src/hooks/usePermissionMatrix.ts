import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { 
  UserPermissionOverride, 
  PermissionProfileProcessTemplate,
  UserProcessTemplateOverride,
  AllPermissionKeys
} from '@/types/permissions';

export function usePermissionMatrix() {
  const [profileProcessTemplates, setProfileProcessTemplates] = useState<PermissionProfileProcessTemplate[]>([]);
  const [userOverrides, setUserOverrides] = useState<UserPermissionOverride[]>([]);
  const [userProcessOverrides, setUserProcessOverrides] = useState<UserProcessTemplateOverride[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        { data: profileProcData },
        { data: userOverridesData },
        { data: userProcData }
      ] = await Promise.all([
        supabase.from('permission_profile_process_templates').select('*'),
        supabase.from('user_permission_overrides').select('*'),
        supabase.from('user_process_template_overrides').select('*'),
      ]);

      setProfileProcessTemplates((profileProcData || []) as unknown as PermissionProfileProcessTemplate[]);
      setUserOverrides((userOverridesData || []) as unknown as UserPermissionOverride[]);
      setUserProcessOverrides((userProcData || []) as unknown as UserProcessTemplateOverride[]);
    } catch (error) {
      console.error('Error fetching permission matrix:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Profile-level process template visibility
  const addProfileProcessTemplate = async (permissionProfileId: string, processTemplateId: string) => {
    const { data, error } = await supabase
      .from('permission_profile_process_templates')
      .insert({ permission_profile_id: permissionProfileId, process_template_id: processTemplateId })
      .select()
      .single();

    if (error) throw error;
    setProfileProcessTemplates(prev => [...prev, data as unknown as PermissionProfileProcessTemplate]);
    return data;
  };

  const removeProfileProcessTemplate = async (permissionProfileId: string, processTemplateId: string) => {
    const { error } = await supabase
      .from('permission_profile_process_templates')
      .delete()
      .eq('permission_profile_id', permissionProfileId)
      .eq('process_template_id', processTemplateId);

    if (error) throw error;
    setProfileProcessTemplates(prev => prev.filter(
      pt => !(pt.permission_profile_id === permissionProfileId && pt.process_template_id === processTemplateId)
    ));
  };

  const getProfileProcessTemplates = (permissionProfileId: string): string[] => {
    return profileProcessTemplates
      .filter(pt => pt.permission_profile_id === permissionProfileId)
      .map(pt => pt.process_template_id);
  };

  // User permission overrides
  const getUserOverrides = (userId: string): UserPermissionOverride | undefined => {
    return userOverrides.find(o => o.user_id === userId);
  };

  const setUserPermissionOverride = async (
    userId: string, 
    key: AllPermissionKeys, 
    value: boolean | null
  ) => {
    const existing = userOverrides.find(o => o.user_id === userId);

    if (existing) {
      const { data, error } = await supabase
        .from('user_permission_overrides')
        .update({ [key]: value, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      setUserOverrides(prev => prev.map(o => o.user_id === userId ? (data as unknown as UserPermissionOverride) : o));
      return data;
    } else {
      const { data, error } = await supabase
        .from('user_permission_overrides')
        .insert({ user_id: userId, [key]: value })
        .select()
        .single();

      if (error) throw error;
      setUserOverrides(prev => [...prev, data as unknown as UserPermissionOverride]);
      return data;
    }
  };

  const clearUserOverride = async (userId: string, key: AllPermissionKeys) => {
    return setUserPermissionOverride(userId, key, null);
  };

  const deleteAllUserOverrides = async (userId: string) => {
    const { error } = await supabase
      .from('user_permission_overrides')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
    setUserOverrides(prev => prev.filter(o => o.user_id !== userId));
  };

  // User process template overrides
  const getUserProcessOverrides = (userId: string): UserProcessTemplateOverride[] => {
    return userProcessOverrides.filter(o => o.user_id === userId);
  };

  const setUserProcessTemplateOverride = async (
    userId: string, 
    processTemplateId: string, 
    isVisible: boolean
  ) => {
    const existing = userProcessOverrides.find(
      o => o.user_id === userId && o.process_template_id === processTemplateId
    );

    if (existing) {
      const { data, error } = await supabase
        .from('user_process_template_overrides')
        .update({ is_visible: isVisible })
        .eq('user_id', userId)
        .eq('process_template_id', processTemplateId)
        .select()
        .single();

      if (error) throw error;
      setUserProcessOverrides(prev => prev.map(o => 
        (o.user_id === userId && o.process_template_id === processTemplateId) 
          ? (data as unknown as UserProcessTemplateOverride) 
          : o
      ));
      return data;
    } else {
      const { data, error } = await supabase
        .from('user_process_template_overrides')
        .insert({ user_id: userId, process_template_id: processTemplateId, is_visible: isVisible })
        .select()
        .single();

      if (error) throw error;
      setUserProcessOverrides(prev => [...prev, data as unknown as UserProcessTemplateOverride]);
      return data;
    }
  };

  const removeUserProcessTemplateOverride = async (userId: string, processTemplateId: string) => {
    const { error } = await supabase
      .from('user_process_template_overrides')
      .delete()
      .eq('user_id', userId)
      .eq('process_template_id', processTemplateId);

    if (error) throw error;
    setUserProcessOverrides(prev => prev.filter(
      o => !(o.user_id === userId && o.process_template_id === processTemplateId)
    ));
  };

  return {
    isLoading,
    refetch: fetchAll,
    // Profile-level process templates
    profileProcessTemplates,
    addProfileProcessTemplate,
    removeProfileProcessTemplate,
    getProfileProcessTemplates,
    // User permission overrides
    userOverrides,
    getUserOverrides,
    setUserPermissionOverride,
    clearUserOverride,
    deleteAllUserOverrides,
    // User process template overrides
    userProcessOverrides,
    getUserProcessOverrides,
    setUserProcessTemplateOverride,
    removeUserProcessTemplateOverride,
  };
}
