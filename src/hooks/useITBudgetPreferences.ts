import { useCallback, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type {
  ITBudgetColumnsConfig,
  ITBudgetFiltersConfig,
  ITBudgetUserPreferences,
} from '@/types/itProject';
import { DEFAULT_COLUMNS_CONFIG } from '@/components/it/budgetColumns';

const LOCAL_STORAGE_KEY = 'it-budget-prefs-v1';

const DEFAULT_PREFS: ITBudgetUserPreferences = {
  columns_config: DEFAULT_COLUMNS_CONFIG,
  filters_config: {},
};

function readLocal(): ITBudgetUserPreferences | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ITBudgetUserPreferences;
  } catch {
    return null;
  }
}

function writeLocal(prefs: ITBudgetUserPreferences): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

export function useITBudgetPreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ?? null;

  const [localPrefs, setLocalPrefs] = useState<ITBudgetUserPreferences>(() => readLocal() ?? DEFAULT_PREFS);

  const prefsQuery = useQuery({
    queryKey: ['it-budget-user-prefs', userId],
    queryFn: async (): Promise<ITBudgetUserPreferences> => {
      if (!userId) return DEFAULT_PREFS;
      const { data, error } = await supabase
        .from('it_budget_user_preferences')
        .select('columns_config, filters_config')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT_PREFS;
      return mergeWithDefaults({
        columns_config: (data.columns_config as ITBudgetColumnsConfig) ?? DEFAULT_COLUMNS_CONFIG,
        filters_config: (data.filters_config as ITBudgetFiltersConfig) ?? {},
      });
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (prefsQuery.data) {
      setLocalPrefs(prefsQuery.data);
      writeLocal(prefsQuery.data);
    }
  }, [prefsQuery.data]);

  const upsertMutation = useMutation({
    mutationFn: async (prefs: ITBudgetUserPreferences) => {
      if (!userId) return prefs;
      const { error } = await supabase
        .from('it_budget_user_preferences')
        .upsert(
          {
            user_id: userId,
            columns_config: prefs.columns_config,
            filters_config: prefs.filters_config,
          },
          { onConflict: 'user_id' }
        );
      if (error) throw error;
      return prefs;
    },
    onSuccess: (prefs) => {
      qc.setQueryData(['it-budget-user-prefs', userId], prefs);
      writeLocal(prefs);
    },
  });

  const savePrefs = useCallback(
    (next: ITBudgetUserPreferences) => {
      setLocalPrefs(next);
      writeLocal(next);
      upsertMutation.mutate(next);
    },
    [upsertMutation]
  );

  const updateColumns = useCallback(
    (columns_config: ITBudgetColumnsConfig) => savePrefs({ ...localPrefs, columns_config }),
    [localPrefs, savePrefs]
  );

  const updateFilters = useCallback(
    (filters_config: ITBudgetFiltersConfig) => savePrefs({ ...localPrefs, filters_config }),
    [localPrefs, savePrefs]
  );

  const resetPrefs = useCallback(() => {
    savePrefs(DEFAULT_PREFS);
  }, [savePrefs]);

  return {
    prefs: localPrefs,
    isLoaded: !userId || prefsQuery.isSuccess || !!readLocal(),
    updateColumns,
    updateFilters,
    resetPrefs,
  };
}

function mergeWithDefaults(saved: ITBudgetUserPreferences): ITBudgetUserPreferences {
  const savedKeys = new Set([...(saved.columns_config.order ?? []), ...(saved.columns_config.hidden ?? [])]);
  const missingVisible = DEFAULT_COLUMNS_CONFIG.order.filter((k) => !savedKeys.has(k));
  const missingHidden = DEFAULT_COLUMNS_CONFIG.hidden.filter((k) => !savedKeys.has(k));
  return {
    columns_config: {
      order: [...(saved.columns_config.order ?? []), ...missingVisible],
      hidden: [...(saved.columns_config.hidden ?? []), ...missingHidden],
    },
    filters_config: saved.filters_config ?? {},
  };
}

