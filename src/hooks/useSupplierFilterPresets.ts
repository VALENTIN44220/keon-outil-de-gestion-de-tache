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
      const { data } = await (supabase as any)
        .from('user_filter_presets')
        .select('id, name, filters, is_default')
        .eq('user_id', user.id)
        .eq('context_type', CONTEXT_TYPE)
        .order('name');

      if (data) {
        const loaded = data.map((p: any) => ({
          id: p.id,
          name: p.name,
          filters: (p.filters?.filters ?? p.filters) as SupplierFilters,
          visible_columns: p.filters?.visible_columns as string[] | undefined,
          is_default: p.is_default,
        }));
        setPresets(loaded);
        const defaultPreset = loaded.find((p: SupplierFilterPreset) => p.is_default);
        if (defaultPreset) {
          setFilters({ ...defaultFilters, ...defaultPreset.filters });
          if (defaultPreset.visible_columns?.length && setVisibleColumns) {
            setVisibleColumns(defaultPreset.visible_columns);
          }
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
        context_type: CONTEXT_TYPE,
      })
      .select()
      .single();

    if (error) { toast.error('Erreur lors de la sauvegarde'); return; }
    setPresets(prev => [...prev, {
      id: data.id, name: data.name,
      filters: data.filters?.filters ?? data.filters,
      visible_columns: data.filters?.visible_columns,
      is_default: false,
    }]);
    toast.success('Contexte sauvegardé');
  }, [user, filters, visibleColumns]);

  const overwritePreset = useCallback(async (presetId: string) => {
    const payload = { filters, visible_columns: visibleColumns };
    const { error } = await (supabase as any)
      .from('user_filter_presets')
      .update({ filters: payload })
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

    await (supabase as any).from('user_filter_presets').update({ is_default: false }).eq('user_id', user.id).eq('context_type', CONTEXT_TYPE);
    if (!wasDefault) {
      // Also update the preset's filters with current visible_columns when setting as default
      const updatedPayload = {
        filters: preset?.filters ?? filters,
        visible_columns: visibleColumns,
      };
      await (supabase as any).from('user_filter_presets')
        .update({ is_default: true, filters: updatedPayload })
        .eq('id', presetId);
    }

    setPresets(prev => prev.map(p => ({
      ...p,
      is_default: p.id === presetId ? !wasDefault : false,
      visible_columns: p.id === presetId && !wasDefault ? visibleColumns : p.visible_columns,
    })));
    toast.success(wasDefault ? 'Contexte par défaut retiré' : 'Contexte défini par défaut');
  }, [user, presets, filters, visibleColumns]);

  const loadPreset = useCallback((preset: SupplierFilterPreset) => {
    setFilters({ ...defaultFilters, ...preset.filters });
    if (setVisibleColumns) {
      if (preset.visible_columns && preset.visible_columns.length > 0) {
        setVisibleColumns(preset.visible_columns);
      }
    }
  }, [defaultFilters, setFilters, setVisibleColumns]);

  return { presets, loaded, savePreset, overwritePreset, deletePreset, toggleDefault, loadPreset };
}
