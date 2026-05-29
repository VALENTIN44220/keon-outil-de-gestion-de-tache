import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { BEAffaireStatus } from '@/types/beAffaire';

/**
 * Snapshot sérialisable des filtres de la page /projects (BE).
 * Les Set sont convertis en string[] pour JSON.
 */
export interface BEProjectsFiltersPayload {
  search: string;
  filterProjectStatus: string[];
  filterHasAffaires: 'all' | 'with' | 'without';
  filterAffaireStatus: BEAffaireStatus[];
  filterActivite: string[];
  sortBy: 'code' | 'name' | 'nb_affaires' | 'created_at';
  sortDir: 'asc' | 'desc';
  viewMode: 'projet' | 'affaire';
}

export interface BEProjectsFilterPreset {
  id: string;
  name: string;
  filters: BEProjectsFiltersPayload;
  is_default: boolean;
  user_id: string;
}

const CONTEXT_TYPE = 'be_projects';

export function useBEProjectsFilterPresets(
  currentFilters: BEProjectsFiltersPayload,
  applyFilters: (f: BEProjectsFiltersPayload) => void,
) {
  const { user } = useAuth();
  const [presets, setPresets] = useState<BEProjectsFilterPreset[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Charge les presets et applique le défaut éventuel
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await (supabase as any)
        .from('user_filter_presets')
        .select('id, name, filters, is_default, user_id')
        .eq('user_id', user.id)
        .eq('context_type', CONTEXT_TYPE)
        .order('name');

      if (error) {
        setLoaded(true);
        return;
      }

      const mapped: BEProjectsFilterPreset[] = (data ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        filters: (p.filters?.filters ?? p.filters) as BEProjectsFiltersPayload,
        is_default: !!p.is_default,
        user_id: p.user_id,
      }));
      setPresets(mapped);

      const def = mapped.find((p) => p.is_default);
      if (def) applyFilters(def.filters);

      setLoaded(true);
    })();
    // Volontairement : on ne réécoute pas applyFilters / currentFilters
    // pour éviter une boucle au mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const savePreset = useCallback(
    async (name: string, setAsDefault = false) => {
      if (!user) return;
      const trimmed = name.trim();
      if (!trimmed) {
        toast.error('Nom du contexte requis');
        return;
      }

      // Si on demande "par défaut" : démarquer les autres
      if (setAsDefault) {
        await (supabase as any)
          .from('user_filter_presets')
          .update({ is_default: false })
          .eq('user_id', user.id)
          .eq('context_type', CONTEXT_TYPE);
      }

      const { data, error } = await (supabase as any)
        .from('user_filter_presets')
        .insert({
          user_id: user.id,
          name: trimmed,
          filters: { filters: currentFilters },
          context_type: CONTEXT_TYPE,
          is_default: setAsDefault,
        })
        .select()
        .single();

      if (error) {
        toast.error('Erreur lors de la sauvegarde');
        return;
      }
      const newPreset: BEProjectsFilterPreset = {
        id: data.id,
        name: data.name,
        filters: (data.filters?.filters ?? data.filters) as BEProjectsFiltersPayload,
        is_default: !!data.is_default,
        user_id: data.user_id,
      };
      setPresets((prev) => {
        const cleared = setAsDefault ? prev.map((p) => ({ ...p, is_default: false })) : prev;
        return [...cleared, newPreset].sort((a, b) => a.name.localeCompare(b.name));
      });
      toast.success(setAsDefault ? 'Contexte sauvegardé et défini par défaut' : 'Contexte sauvegardé');
    },
    [user, currentFilters],
  );

  const overwritePreset = useCallback(
    async (presetId: string) => {
      const { error } = await (supabase as any)
        .from('user_filter_presets')
        .update({ filters: { filters: currentFilters } })
        .eq('id', presetId);
      if (error) {
        toast.error('Erreur lors de la mise à jour');
        return;
      }
      setPresets((prev) =>
        prev.map((p) => (p.id === presetId ? { ...p, filters: currentFilters } : p)),
      );
      toast.success('Contexte mis à jour');
    },
    [currentFilters],
  );

  const deletePreset = useCallback(async (presetId: string) => {
    const { error } = await (supabase as any)
      .from('user_filter_presets')
      .delete()
      .eq('id', presetId);
    if (error) {
      toast.error('Erreur lors de la suppression');
      return;
    }
    setPresets((prev) => prev.filter((p) => p.id !== presetId));
    toast.success('Contexte supprimé');
  }, []);

  const toggleDefault = useCallback(
    async (presetId: string) => {
      if (!user) return;
      const preset = presets.find((p) => p.id === presetId);
      const wasDefault = preset?.is_default;

      await (supabase as any)
        .from('user_filter_presets')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('context_type', CONTEXT_TYPE);

      if (!wasDefault) {
        const { error } = await (supabase as any)
          .from('user_filter_presets')
          .update({ is_default: true })
          .eq('id', presetId);
        if (error) {
          toast.error('Erreur lors de la mise à jour');
          return;
        }
      }
      setPresets((prev) =>
        prev.map((p) => ({
          ...p,
          is_default: p.id === presetId ? !wasDefault : false,
        })),
      );
      toast.success(wasDefault ? 'Défaut retiré' : 'Contexte défini par défaut');
    },
    [user, presets],
  );

  const loadPreset = useCallback(
    (preset: BEProjectsFilterPreset) => {
      applyFilters(preset.filters);
      toast.success(`Contexte « ${preset.name} » chargé`);
    },
    [applyFilters],
  );

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
