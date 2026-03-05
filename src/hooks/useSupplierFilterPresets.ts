import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { SupplierFilters } from './useSupplierEnrichment';

export interface SupplierFilterPreset {
  id: string;
  name: string;
  filters: SupplierFilters;
  visible_columns?: string[];
  is_default: boolean;
  is_global: boolean;
  user_id: string;
}

const CONTEXT_TYPE = 'suppliers';

export function useSupplierFilterPresets(
  filters: SupplierFilters,
  setFilters: (filters: SupplierFilters) => void,
  defaultFilters: SupplierFilters,
  visibleColumns?: string[],
  setVisibleColumns?: (cols: string[]) => void,
) {
  const { user } = useAuth();
  const [presets, setPresets] = useState<SupplierFilterPreset[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Fetch user's own presets + global presets from any user
      const [{ data: ownData }, { data: globalData }] = await Promise.all([
        (supabase as any)
          .from('user_filter_presets')
          .select('id, name, filters, is_default, is_global, user_id, visible_columns')
          .eq('user_id', user.id)
          .eq('context_type', CONTEXT_TYPE)
          .order('name'),
        (supabase as any)
          .from('user_filter_presets')
          .select('id, name, filters, is_default, is_global, user_id, visible_columns')
          .eq('context_type', CONTEXT_TYPE)
          .eq('is_global', true)
          .neq('user_id', user.id)
          .order('name'),
      ]);

      const all = [...(ownData || []), ...(globalData || [])];
      const mapped: SupplierFilterPreset[] = all.map((p: any) => ({
        id: p.id,
        name: p.name,
        filters: (p.filters?.filters ?? p.filters) as SupplierFilters,
        visible_columns: p.visible_columns ?? p.filters?.visible_columns,
        is_default: p.is_default,
        is_global: p.is_global ?? false,
        user_id: p.user_id,
      }));
      setPresets(mapped);

      // Priority: global standard > user's own default
      const globalDefault = mapped.find(p => p.is_global);
      const userDefault = mapped.find(p => p.is_default && p.user_id === user.id);
      const toApply = globalDefault || userDefault;
      if (toApply) {
        setFilters({ ...defaultFilters, ...toApply.filters });
        if (toApply.visible_columns?.length && setVisibleColumns) {
          setVisibleColumns(toApply.visible_columns);
        }
      }
      setLoaded(true);
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
        context_type: CONTEXT_TYPE,
      })
      .select()
      .single();

    if (error) { toast.error('Erreur lors de la sauvegarde'); return; }
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

    const { error: clearError } = await (supabase as any)
      .from('user_filter_presets')
      .update({ is_default: false })
      .eq('user_id', user.id)
      .eq('context_type', CONTEXT_TYPE);

    if (clearError) {
      toast.error('Erreur lors de la mise à jour');
      return;
    }

    if (!wasDefault) {
      const { error: setError } = await (supabase as any)
        .from('user_filter_presets')
        .update({ is_default: true })
        .eq('id', presetId);

      if (setError) {
        toast.error('Erreur lors de la mise à jour');
        return;
      }
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

    // If setting as global, clear other globals for this context
    if (newGlobal) {
      await (supabase as any)
        .from('user_filter_presets')
        .update({ is_global: false })
        .eq('context_type', CONTEXT_TYPE)
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

  const loadPreset = useCallback((preset: SupplierFilterPreset) => {
    setFilters({ ...defaultFilters, ...preset.filters });
    if (setVisibleColumns) {
      if (preset.visible_columns && preset.visible_columns.length > 0) {
        setVisibleColumns(preset.visible_columns);
      }
    }
  }, [defaultFilters, setFilters, setVisibleColumns]);

  return { presets, loaded, savePreset, overwritePreset, deletePreset, toggleDefault, toggleGlobal, loadPreset };
}
