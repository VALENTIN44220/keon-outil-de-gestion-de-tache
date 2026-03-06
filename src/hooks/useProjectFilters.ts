import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BEProject } from '@/types/beProject';
import { toast } from 'sonner';
import { QUESTIONNAIRE_FILTER_FIELDS, qstFilterKey, QST_FILTER_PREFIX } from '@/config/questionnaireFilterConfig';
import { QuestionnaireProjectMap } from '@/hooks/useQuestionnaireProjectData';

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
  // Dynamic questionnaire filters: key = "qst_<champ_id>", value = string[]
  [key: string]: string[] | string | null;
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
  // Initialize questionnaire filters
  ...Object.fromEntries(QUESTIONNAIRE_FILTER_FIELDS.map(f => [qstFilterKey(f.champ_id), []])),
};

export interface FilterPreset {
  id: string;
  name: string;
  filters: ProjectFiltersState;
  visible_columns?: string[];
  is_default: boolean;
  is_global: boolean;
  user_id: string;
}

export function useProjectFilters(visibleColumns?: string[], setVisibleColumns?: (cols: string[]) => void) {
  const { user } = useAuth();
  const [filters, setFilters] = useState<ProjectFiltersState>(DEFAULT_PROJECT_FILTERS);
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [presetsLoaded, setPresetsLoaded] = useState(false);
  const [qstData, setQstData] = useState<QuestionnaireProjectMap>({});

  /** Allows parent to inject questionnaire data for filter application */
  const setQuestionnaireData = useCallback((data: QuestionnaireProjectMap) => {
    setQstData(data);
  }, []);

  // Load presets and apply default
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: ownData }, { data: globalData }] = await Promise.all([
        (supabase as any)
          .from('user_filter_presets')
          .select('id, name, filters, is_default, is_global, user_id, visible_columns')
          .eq('user_id', user.id)
          .eq('context_type', 'projects')
          .order('name'),
        (supabase as any)
          .from('user_filter_presets')
          .select('id, name, filters, is_default, is_global, user_id, visible_columns')
          .eq('context_type', 'projects')
          .eq('is_global', true)
          .neq('user_id', user.id)
          .order('name'),
      ]);

      const all = [...(ownData || []), ...(globalData || [])];
      const loaded: FilterPreset[] = all.map((p: any) => ({
        id: p.id,
        name: p.name,
        filters: (p.filters?.filters ?? p.filters) as ProjectFiltersState,
        visible_columns: p.visible_columns ?? p.filters?.visible_columns,
        is_default: p.is_default,
        is_global: p.is_global ?? false,
        user_id: p.user_id,
      }));
      setPresets(loaded);

      const userDefault = loaded.find(p => p.is_default && p.user_id === user.id);
      const globalDefault = loaded.find(p => p.is_global);
      const toApply = userDefault || globalDefault;
      if (toApply) {
        setFilters({ ...DEFAULT_PROJECT_FILTERS, ...toApply.filters });
        if (toApply.visible_columns?.length && setVisibleColumns) {
          setVisibleColumns(toApply.visible_columns);
        }
      }
      setPresetsLoaded(true);
    })();
  }, [user]);

  const savePreset = useCallback(async (name: string) => {
    if (!user) return;
    const payload = { filters, visible_columns: visibleColumns };
    const { data, error } = await (supabase as any)
      .from('user_filter_presets')
      .insert({
        user_id: user.id,
        name,
        filters: payload,
        visible_columns: visibleColumns ? JSON.parse(JSON.stringify(visibleColumns)) : null,
        context_type: 'projects',
      })
      .select()
      .single();

    if (error) {
      toast.error('Erreur lors de la sauvegarde');
      return;
    }
    setPresets(prev => [...prev, {
      id: data.id, name: data.name,
      filters: data.filters?.filters ?? data.filters,
      visible_columns: data.visible_columns ?? data.filters?.visible_columns,
      is_default: false,
      is_global: false,
      user_id: data.user_id,
    }]);
    toast.success('Contexte sauvegardé');
  }, [user, filters, visibleColumns]);

  const overwritePreset = useCallback(async (presetId: string) => {
    const payload = { filters, visible_columns: visibleColumns };
    const { error } = await (supabase as any)
      .from('user_filter_presets')
      .update({ filters: payload, visible_columns: visibleColumns ? JSON.parse(JSON.stringify(visibleColumns)) : null })
      .eq('id', presetId);

    if (error) { toast.error('Erreur lors de la mise à jour'); return; }
    setPresets(prev => prev.map(p => p.id === presetId ? { ...p, filters, visible_columns: visibleColumns } : p));
    toast.success('Contexte mis à jour');
  }, [filters, visibleColumns]);

  const deletePreset = useCallback(async (presetId: string) => {
    await (supabase as any).from('user_filter_presets').delete().eq('id', presetId);
    setPresets(prev => prev.filter(p => p.id !== presetId));
    toast.success('Contexte supprimé');
  }, []);

  const toggleDefault = useCallback(async (presetId: string) => {
    if (!user) return;
    const preset = presets.find(p => p.id === presetId);
    const wasDefault = preset?.is_default;

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
      is_default: p.id === presetId ? !wasDefault : (p.user_id === user.id ? false : p.is_default),
    })));
    toast.success(wasDefault ? 'Contexte par défaut retiré' : 'Contexte défini par défaut');
  }, [user, presets]);

  const toggleGlobal = useCallback(async (presetId: string) => {
    if (!user) return;
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;
    const newGlobal = !preset.is_global;

    if (newGlobal) {
      await (supabase as any)
        .from('user_filter_presets')
        .update({ is_global: false })
        .eq('context_type', 'projects')
        .eq('is_global', true);
    }

    await (supabase as any)
      .from('user_filter_presets')
      .update({ is_global: newGlobal })
      .eq('id', presetId);

    setPresets(prev => prev.map(p => ({
      ...p,
      is_global: p.id === presetId ? newGlobal : (newGlobal ? false : p.is_global),
    })));
    toast.success(newGlobal ? 'Contexte défini comme standard global' : 'Standard global retiré');
  }, [user, presets]);

  const loadPreset = useCallback((preset: FilterPreset) => {
    setFilters({ ...DEFAULT_PROJECT_FILTERS, ...preset.filters });
    if (setVisibleColumns && preset.visible_columns?.length) {
      setVisibleColumns(preset.visible_columns);
    }
  }, [setVisibleColumns]);

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
    // Count active questionnaire filters
    for (const field of QUESTIONNAIRE_FILTER_FIELDS) {
      const key = qstFilterKey(field.champ_id);
      const val = filters[key];
      if (Array.isArray(val) && val.length > 0) count++;
    }
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

      const checkDate = (value: string | null, from: string | null, to: string | null) => {
        if (!from && !to) return true;
        if (!value) return false;
        if (from && value < from) return false;
        if (to && value > to) return false;
        return true;
      };

      if (!checkDate(p.date_os_etude, filters.date_os_etude_from as string | null, filters.date_os_etude_to as string | null)) return false;
      if (!checkDate(p.date_os_travaux, filters.date_os_travaux_from as string | null, filters.date_os_travaux_to as string | null)) return false;
      if (!checkDate(p.date_cloture_bancaire, filters.date_cloture_bancaire_from as string | null, filters.date_cloture_bancaire_to as string | null)) return false;
      if (!checkDate(p.date_cloture_juridique, filters.date_cloture_juridique_from as string | null, filters.date_cloture_juridique_to as string | null)) return false;

      // Apply questionnaire filters
      for (const field of QUESTIONNAIRE_FILTER_FIELDS) {
        const key = qstFilterKey(field.champ_id);
        const selectedValues = filters[key];
        if (Array.isArray(selectedValues) && selectedValues.length > 0) {
          const projectQstValue = qstData[p.id]?.[field.champ_id];
          if (!projectQstValue || !selectedValues.includes(projectQstValue)) return false;
        }
      }

      return true;
    });
  }, [filters, qstData]);

  return {
    filters,
    setFilters,
    presets,
    presetsLoaded,
    savePreset,
    overwritePreset,
    deletePreset,
    toggleDefault,
    toggleGlobal,
    loadPreset,
    clearFilters,
    activeFiltersCount,
    applyFilters,
    setQuestionnaireData,
  };
}
