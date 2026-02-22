import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BEProject } from '@/types/beProject';
import { toast } from 'sonner';

export interface ProjectFiltersState {
  statuses: string[];
  pays: string[];
  regions: string[];
  typologies: string[];
  actionnariats: string[];
  regimes_icpe: string[];
  date_os_etude_from: string | null;
  date_os_etude_to: string | null;
  date_os_travaux_from: string | null;
  date_os_travaux_to: string | null;
  date_cloture_bancaire_from: string | null;
  date_cloture_bancaire_to: string | null;
  date_cloture_juridique_from: string | null;
  date_cloture_juridique_to: string | null;
}

export const DEFAULT_PROJECT_FILTERS: ProjectFiltersState = {
  statuses: [],
  pays: [],
  regions: [],
  typologies: [],
  actionnariats: [],
  regimes_icpe: [],
  date_os_etude_from: null,
  date_os_etude_to: null,
  date_os_travaux_from: null,
  date_os_travaux_to: null,
  date_cloture_bancaire_from: null,
  date_cloture_bancaire_to: null,
  date_cloture_juridique_from: null,
  date_cloture_juridique_to: null,
};

export interface FilterPreset {
  id: string;
  name: string;
  filters: ProjectFiltersState;
  is_default: boolean;
}

export function useProjectFilters() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<ProjectFiltersState>(DEFAULT_PROJECT_FILTERS);
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [presetsLoaded, setPresetsLoaded] = useState(false);

  // Load presets and apply default
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('user_filter_presets')
        .select('id, name, filters, is_default')
        .eq('user_id', user.id)
        .eq('context_type', 'projects')
        .order('name');

      if (data) {
        const loaded = data.map((p: any) => ({
          id: p.id,
          name: p.name,
          filters: p.filters as ProjectFiltersState,
          is_default: p.is_default,
        }));
        setPresets(loaded);
        const defaultPreset = loaded.find((p: FilterPreset) => p.is_default);
        if (defaultPreset) {
          setFilters({ ...DEFAULT_PROJECT_FILTERS, ...defaultPreset.filters });
        }
      }
      setPresetsLoaded(true);
    })();
  }, [user]);

  const savePreset = useCallback(async (name: string) => {
    if (!user) return;
    const { data, error } = await (supabase as any)
      .from('user_filter_presets')
      .insert({
        user_id: user.id,
        name,
        filters: filters,
        context_type: 'projects',
      })
      .select()
      .single();

    if (error) {
      toast.error('Erreur lors de la sauvegarde');
      return;
    }
    setPresets(prev => [...prev, { id: data.id, name: data.name, filters: data.filters, is_default: false }]);
    toast.success('Contexte sauvegardé');
  }, [user, filters]);

  const deletePreset = useCallback(async (presetId: string) => {
    await (supabase as any).from('user_filter_presets').delete().eq('id', presetId);
    setPresets(prev => prev.filter(p => p.id !== presetId));
    toast.success('Contexte supprimé');
  }, []);

  const toggleDefault = useCallback(async (presetId: string) => {
    if (!user) return;
    const preset = presets.find(p => p.id === presetId);
    const wasDefault = preset?.is_default;

    // Clear defaults for projects context
    await (supabase as any)
      .from('user_filter_presets')
      .update({ is_default: false })
      .eq('user_id', user.id)
      .eq('context_type', 'projects');

    if (!wasDefault) {
      await (supabase as any)
        .from('user_filter_presets')
        .update({ is_default: true })
        .eq('id', presetId);
    }

    setPresets(prev => prev.map(p => ({
      ...p,
      is_default: p.id === presetId ? !wasDefault : false,
    })));
  }, [user, presets]);

  const loadPreset = useCallback((preset: FilterPreset) => {
    setFilters({ ...DEFAULT_PROJECT_FILTERS, ...preset.filters });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_PROJECT_FILTERS);
  }, []);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.statuses.length > 0) count++;
    if (filters.pays.length > 0) count++;
    if (filters.regions.length > 0) count++;
    if (filters.typologies.length > 0) count++;
    if (filters.actionnariats.length > 0) count++;
    if (filters.regimes_icpe.length > 0) count++;
    if (filters.date_os_etude_from || filters.date_os_etude_to) count++;
    if (filters.date_os_travaux_from || filters.date_os_travaux_to) count++;
    if (filters.date_cloture_bancaire_from || filters.date_cloture_bancaire_to) count++;
    if (filters.date_cloture_juridique_from || filters.date_cloture_juridique_to) count++;
    return count;
  }, [filters]);

  const applyFilters = useCallback((projects: BEProject[]): BEProject[] => {
    return projects.filter(p => {
      if (filters.statuses.length > 0 && !filters.statuses.includes(p.status)) return false;
      if (filters.pays.length > 0 && (!p.pays || !filters.pays.includes(p.pays))) return false;
      if (filters.regions.length > 0 && (!p.region || !filters.regions.includes(p.region))) return false;
      if (filters.typologies.length > 0 && (!p.typologie || !filters.typologies.includes(p.typologie))) return false;
      if (filters.actionnariats.length > 0 && (!p.actionnariat || !filters.actionnariats.includes(p.actionnariat))) return false;
      if (filters.regimes_icpe.length > 0 && (!p.regime_icpe || !filters.regimes_icpe.includes(p.regime_icpe))) return false;

      // Date filters
      const checkDate = (value: string | null, from: string | null, to: string | null) => {
        if (!from && !to) return true;
        if (!value) return false;
        if (from && value < from) return false;
        if (to && value > to) return false;
        return true;
      };

      if (!checkDate(p.date_os_etude, filters.date_os_etude_from, filters.date_os_etude_to)) return false;
      if (!checkDate(p.date_os_travaux, filters.date_os_travaux_from, filters.date_os_travaux_to)) return false;
      if (!checkDate(p.date_cloture_bancaire, filters.date_cloture_bancaire_from, filters.date_cloture_bancaire_to)) return false;
      if (!checkDate(p.date_cloture_juridique, filters.date_cloture_juridique_from, filters.date_cloture_juridique_to)) return false;

      return true;
    });
  }, [filters]);

  return {
    filters,
    setFilters,
    presets,
    presetsLoaded,
    savePreset,
    deletePreset,
    toggleDefault,
    loadPreset,
    clearFilters,
    activeFiltersCount,
    applyFilters,
  };
}
