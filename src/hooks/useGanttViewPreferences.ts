import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type GroupByOption = 'none' | 'department' | 'company' | 'team';
export type ZoomLevel = 'day' | 'week' | 'month';

export interface GanttColumnConfig {
  avatar: boolean;
  name: boolean;
  role: boolean;
  department: boolean;
  capacity: boolean;
  taskCount: boolean;
}

export interface GanttViewPreferences {
  groupBy: GroupByOption;
  zoomLevel: ZoomLevel;
  showHeatmap: boolean;
  showWeekends: boolean;
  showHolidays: boolean;
  showLeaves: boolean;
  compactMode: boolean;
  columnConfig: GanttColumnConfig;
  rowHeight: number;
  taskSidebarWidth: number;
  memberColumnWidth: number;
}

const DEFAULT_PREFERENCES: GanttViewPreferences = {
  groupBy: 'none',
  zoomLevel: 'week',
  showHeatmap: true,
  showWeekends: true,
  showHolidays: true,
  showLeaves: true,
  compactMode: false,
  columnConfig: {
    avatar: true,
    name: true,
    role: true,
    department: false,
    capacity: true,
    taskCount: true,
  },
  rowHeight: 72,
  taskSidebarWidth: 320,
  memberColumnWidth: 260,
};

const STORAGE_KEY = 'gantt-view-preferences';

export function useGanttViewPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<GanttViewPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences({ ...DEFAULT_PREFERENCES, ...parsed });
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save preferences to localStorage
  const savePreferences = useCallback((newPrefs: Partial<GanttViewPreferences>) => {
    setPreferences(prev => {
      const updated = { ...prev, ...newPrefs };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Error saving preferences:', error);
      }
      return updated;
    });
  }, []);

  // Individual setters for convenience
  const setGroupBy = useCallback((groupBy: GroupByOption) => {
    savePreferences({ groupBy });
  }, [savePreferences]);

  const setZoomLevel = useCallback((zoomLevel: ZoomLevel) => {
    savePreferences({ zoomLevel });
  }, [savePreferences]);

  const toggleHeatmap = useCallback(() => {
    savePreferences({ showHeatmap: !preferences.showHeatmap });
  }, [preferences.showHeatmap, savePreferences]);

  const toggleWeekends = useCallback(() => {
    savePreferences({ showWeekends: !preferences.showWeekends });
  }, [preferences.showWeekends, savePreferences]);

  const toggleCompactMode = useCallback(() => {
    savePreferences({ compactMode: !preferences.compactMode });
  }, [preferences.compactMode, savePreferences]);

  const setColumnConfig = useCallback((config: Partial<GanttColumnConfig>) => {
    savePreferences({ 
      columnConfig: { ...preferences.columnConfig, ...config } 
    });
  }, [preferences.columnConfig, savePreferences]);

  const setRowHeight = useCallback((height: number) => {
    savePreferences({ rowHeight: Math.max(48, Math.min(120, height)) });
  }, [savePreferences]);

  const setMemberColumnWidth = useCallback((width: number) => {
    savePreferences({ memberColumnWidth: Math.max(180, Math.min(400, width)) });
  }, [savePreferences]);

  const resetToDefaults = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    try {
      localStorage.removeItem(STORAGE_KEY);
      toast.success('Préférences réinitialisées');
    } catch (error) {
      console.error('Error resetting preferences:', error);
    }
  }, []);

  return {
    preferences,
    isLoading,
    savePreferences,
    setGroupBy,
    setZoomLevel,
    toggleHeatmap,
    toggleWeekends,
    toggleCompactMode,
    setColumnConfig,
    setRowHeight,
    setMemberColumnWidth,
    resetToDefaults,
  };
}
