import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from '@/hooks/use-toast';
import { getDefaultVisibleColumns, ALL_PROJECT_COLUMNS } from '@/components/projects/ProjectColumnSelector';
import { Json } from '@/integrations/supabase/types';

export interface ColumnFilter {
  value: string;
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith';
}

export interface ProjectViewConfig {
  id?: string;
  user_id: string | null;
  view_type: 'standard' | 'custom';
  visible_columns: string[];
  column_order: string[];
  column_filters: Record<string, ColumnFilter>;
  is_active: boolean;
}

export function useProjectViewConfig() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [standardConfig, setStandardConfig] = useState<ProjectViewConfig | null>(null);
  const [customConfig, setCustomConfig] = useState<ProjectViewConfig | null>(null);
  const [activeViewType, setActiveViewType] = useState<'standard' | 'custom'>('standard');
  const [isLoading, setIsLoading] = useState(true);

  // Memoize default values to prevent infinite loops
  const defaultColumns = useMemo(() => getDefaultVisibleColumns(), []);
  const defaultOrder = useMemo(() => ALL_PROJECT_COLUMNS.map(c => c.key), []);

  const parseFilters = useCallback((data: Json | null): Record<string, ColumnFilter> => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    return data as unknown as Record<string, ColumnFilter>;
  }, []);

  const fetchConfigs = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Fetch standard config (user_id is null)
      const { data: standardData } = await supabase
        .from('project_view_configs')
        .select('*')
        .is('user_id', null)
        .eq('view_type', 'standard')
        .maybeSingle();

      if (standardData) {
        setStandardConfig({
          id: standardData.id,
          user_id: standardData.user_id,
          view_type: standardData.view_type as 'standard',
          visible_columns: standardData.visible_columns || defaultColumns,
          column_order: standardData.column_order || defaultOrder,
          column_filters: parseFilters(standardData.column_filters),
          is_active: standardData.is_active,
        });
      } else {
        // Default standard config
        setStandardConfig({
          user_id: null,
          view_type: 'standard',
          visible_columns: defaultColumns,
          column_order: defaultOrder,
          column_filters: {},
          is_active: true,
        });
      }

      // Fetch user's custom config
      const { data: customData } = await supabase
        .from('project_view_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('view_type', 'custom')
        .maybeSingle();

      if (customData) {
        setCustomConfig({
          id: customData.id,
          user_id: customData.user_id,
          view_type: customData.view_type as 'custom',
          visible_columns: customData.visible_columns || defaultColumns,
          column_order: customData.column_order || defaultOrder,
          column_filters: parseFilters(customData.column_filters),
          is_active: customData.is_active,
        });
        if (customData.is_active) {
          setActiveViewType('custom');
        }
      }
    } catch (error) {
      console.error('Error fetching view configs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, defaultColumns, defaultOrder, parseFilters]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const saveStandardConfig = async (config: Partial<ProjectViewConfig>) => {
    if (!isAdmin) {
      toast({
        title: 'Accès refusé',
        description: 'Seuls les administrateurs peuvent modifier la vue standard',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const filtersJson = (config.column_filters || {}) as unknown as Json;
      
      if (standardConfig?.id) {
        const { error } = await supabase
          .from('project_view_configs')
          .update({
            visible_columns: config.visible_columns || defaultColumns,
            column_order: config.column_order || defaultOrder,
            column_filters: filtersJson,
            is_active: true,
          })
          .eq('id', standardConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('project_view_configs')
          .insert({
            user_id: null,
            view_type: 'standard',
            visible_columns: config.visible_columns || defaultColumns,
            column_order: config.column_order || defaultOrder,
            column_filters: filtersJson,
            is_active: true,
          });
        if (error) throw error;
      }

      toast({
        title: 'Vue standard enregistrée',
        description: 'La configuration a été sauvegardée',
      });
      await fetchConfigs();
      return true;
    } catch (error: any) {
      console.error('Error saving standard config:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de sauvegarder la configuration',
        variant: 'destructive',
      });
      return false;
    }
  };

  const saveCustomConfig = async (config: Partial<ProjectViewConfig>) => {
    if (!user) return false;

    try {
      const filtersJson = (config.column_filters || {}) as unknown as Json;

      if (customConfig?.id) {
        const { error } = await supabase
          .from('project_view_configs')
          .update({
            visible_columns: config.visible_columns || defaultColumns,
            column_order: config.column_order || defaultOrder,
            column_filters: filtersJson,
            is_active: true,
          })
          .eq('id', customConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('project_view_configs')
          .insert({
            user_id: user.id,
            view_type: 'custom',
            visible_columns: config.visible_columns || defaultColumns,
            column_order: config.column_order || defaultOrder,
            column_filters: filtersJson,
            is_active: true,
          });
        if (error) throw error;
      }

      toast({
        title: 'Vue personnalisée enregistrée',
        description: 'Votre configuration a été sauvegardée',
      });
      await fetchConfigs();
      return true;
    } catch (error: any) {
      console.error('Error saving custom config:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de sauvegarder la configuration',
        variant: 'destructive',
      });
      return false;
    }
  };

  const switchView = (viewType: 'standard' | 'custom') => {
    setActiveViewType(viewType);
  };

  const getActiveConfig = (): ProjectViewConfig => {
    if (activeViewType === 'custom' && customConfig) {
      return customConfig;
    }
    return standardConfig || {
      user_id: null,
      view_type: 'standard',
      visible_columns: defaultColumns,
      column_order: defaultOrder,
      column_filters: {},
      is_active: true,
    };
  };

  return {
    standardConfig,
    customConfig,
    activeViewType,
    isLoading,
    isAdmin,
    saveStandardConfig,
    saveCustomConfig,
    switchView,
    getActiveConfig,
    refetch: fetchConfigs,
  };
}
