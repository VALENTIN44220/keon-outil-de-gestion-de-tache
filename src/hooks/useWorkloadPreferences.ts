import { useState, useEffect, useCallback } from 'react';

export type GroupByOption = 'none' | 'department' | 'company' | 'team';
export type ZoomLevel = 'day' | 'week' | 'month';

export interface WorkloadColumnConfig {
  avatar: boolean;
  name: boolean;
  role: boolean;
  department: boolean;
  capacity: boolean;
}

export interface WorkloadPreferences {
  groupBy: GroupByOption;
  zoomLevel: ZoomLevel;
  columns: WorkloadColumnConfig;
  showHeatmap: boolean;
  compactMode: boolean;
  showWeekends: boolean;
  showTodayLine: boolean;
  memberColumnWidth: number;
}

const DEFAULT_PREFERENCES: WorkloadPreferences = {
  groupBy: 'none',
  zoomLevel: 'week',
  columns: {
    avatar: true,
    name: true,
    role: true,
    department: true,
    capacity: true,
  },
  showHeatmap: false,
  compactMode: false,
  showWeekends: true,
  showTodayLine: true,
  memberColumnWidth: 260,
};

const STORAGE_KEY = 'keon-workload-preferences';

export function useWorkloadPreferences() {
  const [preferences, setPreferences] = useState<WorkloadPreferences>(() => {
    if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_PREFERENCES, ...parsed };
      }
    } catch (error) {
      console.warn('Failed to load workload preferences:', error);
    }
    return DEFAULT_PREFERENCES;
  });

  // Persist to localStorage whenever preferences change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.warn('Failed to save workload preferences:', error);
    }
  }, [preferences]);

  const updatePreference = useCallback(<K extends keyof WorkloadPreferences>(
    key: K,
    value: WorkloadPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateColumn = useCallback((column: keyof WorkloadColumnConfig, visible: boolean) => {
    setPreferences(prev => ({
      ...prev,
      columns: { ...prev.columns, [column]: visible },
    }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
  }, []);

  const toggleHeatmap = useCallback(() => {
    setPreferences(prev => ({ ...prev, showHeatmap: !prev.showHeatmap }));
  }, []);

  const setGroupBy = useCallback((groupBy: GroupByOption) => {
    setPreferences(prev => ({ ...prev, groupBy }));
  }, []);

  const setZoomLevel = useCallback((zoomLevel: ZoomLevel) => {
    setPreferences(prev => ({ ...prev, zoomLevel }));
  }, []);

  const toggleCompactMode = useCallback(() => {
    setPreferences(prev => ({ ...prev, compactMode: !prev.compactMode }));
  }, []);

  return {
    preferences,
    updatePreference,
    updateColumn,
    resetToDefaults,
    toggleHeatmap,
    setGroupBy,
    setZoomLevel,
    toggleCompactMode,
  };
}
