import { useCallback, useEffect, useState } from 'react';

export interface WorkloadPreferencesState {
  zoomLevel: 'day' | 'week' | 'month';
  compactMode: boolean;
  showHeatmap: boolean;
  memberColumnWidth: number;
  groupBy: 'none' | 'department' | 'company';
  visibleColumns: string[];
  collapsedGroups: string[];
}

const STORAGE_KEY = 'workload-preferences';

const DEFAULT_PREFERENCES: WorkloadPreferencesState = {
  zoomLevel: 'week',
  compactMode: false,
  showHeatmap: false,
  memberColumnWidth: 260,
  groupBy: 'none',
  visibleColumns: ['name', 'capacity', 'tasks'],
  collapsedGroups: [],
};

export function useWorkloadPreferencesEnhanced() {
  const [preferences, setPreferences] = useState<WorkloadPreferencesState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Error loading workload preferences:', error);
    }
    return DEFAULT_PREFERENCES;
  });

  // Persist preferences to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Error saving workload preferences:', error);
    }
  }, [preferences]);

  const updatePreference = useCallback(<K extends keyof WorkloadPreferencesState>(
    key: K,
    value: WorkloadPreferencesState[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  }, []);

  const setZoomLevel = useCallback((level: 'day' | 'week' | 'month') => {
    updatePreference('zoomLevel', level);
  }, [updatePreference]);

  const setCompactMode = useCallback((compact: boolean) => {
    updatePreference('compactMode', compact);
  }, [updatePreference]);

  const setShowHeatmap = useCallback((show: boolean) => {
    updatePreference('showHeatmap', show);
  }, [updatePreference]);

  const setGroupBy = useCallback((groupBy: 'none' | 'department' | 'company') => {
    updatePreference('groupBy', groupBy);
  }, [updatePreference]);

  const toggleGroupCollapse = useCallback((groupId: string) => {
    setPreferences(prev => {
      const collapsed = prev.collapsedGroups.includes(groupId)
        ? prev.collapsedGroups.filter(id => id !== groupId)
        : [...prev.collapsedGroups, groupId];
      return { ...prev, collapsedGroups: collapsed };
    });
  }, []);

  const isGroupCollapsed = useCallback((groupId: string) => {
    return preferences.collapsedGroups.includes(groupId);
  }, [preferences.collapsedGroups]);

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
  }, []);

  return {
    preferences,
    setPreferences,
    updatePreference,
    setZoomLevel,
    setCompactMode,
    setShowHeatmap,
    setGroupBy,
    toggleGroupCollapse,
    isGroupCollapsed,
    resetPreferences,
  };
}
