import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Préférences d'affichage par utilisateur et par vue (feuille de route, plan de
 * charge…). Persistance localStorage (instantané) + Supabase (it_view_preferences).
 *
 * `defaults` DOIT être une constante stable (objet défini au niveau module) pour
 * éviter des re-rendus inutiles.
 */
export function useViewPreferences<T extends object>(viewKey: string, defaults: T) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ?? null;
  const LS_KEY = `it-view-prefs:${viewKey}`;
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const readLocal = useCallback((): T | null => {
    try { const raw = localStorage.getItem(LS_KEY); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
  }, [LS_KEY]);
  const writeLocal = useCallback((cfg: T) => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); } catch { /* ignore */ }
  }, [LS_KEY]);

  const [local, setLocal] = useState<T>(() => {
    const l = readLocal();
    return l ? { ...defaults, ...l } : defaults;
  });

  const query = useQuery({
    queryKey: ['it-view-prefs', viewKey, userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<T> => {
      if (!userId) return defaultsRef.current;
      const { data, error } = await supabase
        .from('it_view_preferences')
        .select('config')
        .eq('user_id', userId)
        .eq('view_key', viewKey)
        .maybeSingle();
      if (error) throw error;
      if (!data) return defaultsRef.current;
      return { ...defaultsRef.current, ...((data.config as T) ?? {}) };
    },
  });

  useEffect(() => {
    if (query.data) { setLocal(query.data); writeLocal(query.data); }
  }, [query.data, writeLocal]);

  const mutation = useMutation({
    mutationFn: async (cfg: T) => {
      if (!userId) return cfg;
      const { error } = await supabase
        .from('it_view_preferences')
        .upsert(
          { user_id: userId, view_key: viewKey, config: cfg, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,view_key' },
        );
      if (error) throw error;
      return cfg;
    },
    onSuccess: (cfg) => {
      qc.setQueryData(['it-view-prefs', viewKey, userId], cfg);
      writeLocal(cfg);
    },
  });

  /** Enregistre la config comme standard personnel. */
  const save = useCallback((cfg: T) => {
    setLocal(cfg);
    writeLocal(cfg);
    mutation.mutate(cfg);
  }, [mutation, writeLocal]);

  /** Réinitialise (supprime la préférence enregistrée → retour aux défauts). */
  const reset = useCallback(() => {
    setLocal(defaultsRef.current);
    writeLocal(defaultsRef.current);
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
    if (userId) {
      void supabase.from('it_view_preferences').delete().eq('user_id', userId).eq('view_key', viewKey)
        .then(() => qc.invalidateQueries({ queryKey: ['it-view-prefs', viewKey, userId] }));
    }
  }, [LS_KEY, userId, viewKey, qc, writeLocal]);

  return {
    config: local,
    isLoaded: !userId || query.isSuccess || !!readLocal(),
    save,
    reset,
    isSaving: mutation.isPending,
  };
}
