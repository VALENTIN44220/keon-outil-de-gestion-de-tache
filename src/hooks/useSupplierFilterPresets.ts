import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { SupplierFilters } from './useSupplierEnrichment';

export interface SupplierFilterPreset {
  id: string;
  name: string;
  filters: SupplierFilters;
  is_default: boolean;
}

const CONTEXT_TYPE = 'suppliers';

export function useSupplierFilterPresets(
  filters: SupplierFilters,
  setFilters: (filters: SupplierFilters) => void,
  defaultFilters: SupplierFilters,
) {
  const { user } = useAuth();
  const [presets, setPresets] = useState<SupplierFilterPreset[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load presets and apply default
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
          filters: p.filters as SupplierFilters,
          is_default: p.is_default,
        }));
        setPresets(loaded);
        const defaultPreset = loaded.find((p: SupplierFilterPreset) => p.is_default);
        if (defaultPreset) {
          setFilters({ ...defaultFilters, ...defaultPreset.filters });
        }
      }
      setLoaded(true);
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
        context_type: CONTEXT_TYPE,
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

  const overwritePreset = useCallback(async (presetId: string) => {
    const { error } = await (supabase as any)
      .from('user_filter_presets')
      .update({ filters })
      .eq('id', presetId);

    if (error) {
      toast.error('Erreur lors de la mise à jour');
      return;
    }
    setPresets(prev => prev.map(p => p.id === presetId ? { ...p, filters } : p));
    toast.success('Contexte mis à jour');
  }, [filters]);

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
      .eq('context_type', CONTEXT_TYPE);

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
    toast.success(wasDefault ? 'Contexte par défaut retiré' : 'Contexte défini par défaut');
  }, [user, presets]);

  const loadPreset = useCallback((preset: SupplierFilterPreset) => {
    setFilters({ ...defaultFilters, ...preset.filters });
  }, [defaultFilters, setFilters]);

  return {
    presets,
    loaded,
    savePreset,
    overwritePreset,
    deletePreset,
    toggleDefault,
    loadPreset,
  };
}
