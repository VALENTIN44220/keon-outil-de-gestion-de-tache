import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PageDeviceVisibility {
  id: string;
  page_id: string;
  page_label: string;
  visible_on_desktop: boolean;
  visible_on_tablet: boolean;
  visible_on_mobile: boolean;
}

type DeviceType = 'desktop' | 'tablet' | 'mobile';
type DeviceField = 'visible_on_desktop' | 'visible_on_tablet' | 'visible_on_mobile';

export function usePageDeviceVisibility() {
  const [visibilities, setVisibilities] = useState<PageDeviceVisibility[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchVisibilities = useCallback(async () => {
    const { data, error } = await supabase
      .from('page_device_visibility')
      .select('*')
      .order('page_label');

    if (!error && data) {
      setVisibilities(data as unknown as PageDeviceVisibility[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchVisibilities();
  }, [fetchVisibilities]);

  /**
   * Active/désactive la visibilité d'un écran sur un appareil.
   *
   * Upsert (et non update) : un écran présent dans le menu mais absent de la
   * table doit pouvoir être configuré dès le premier toggle. On envoie les trois
   * champs d'appareil pour ne pas écraser les autres lors d'un conflit.
   */
  const updateVisibility = useCallback(async (
    pageId: string,
    pageLabel: string,
    field: DeviceField,
    value: boolean
  ) => {
    const existing = visibilities.find(v => v.page_id === pageId);
    const merged = {
      visible_on_desktop: existing?.visible_on_desktop ?? true,
      visible_on_tablet: existing?.visible_on_tablet ?? true,
      visible_on_mobile: existing?.visible_on_mobile ?? true,
      [field]: value,
    };

    // Optimistic update
    setVisibilities(prev => {
      if (existing) {
        return prev.map(v => (v.page_id === pageId ? { ...v, ...merged } : v));
      }
      return [...prev, { id: `temp-${pageId}`, page_id: pageId, page_label: pageLabel, ...merged }];
    });

    const { error } = await supabase
      .from('page_device_visibility')
      .upsert(
        { page_id: pageId, page_label: pageLabel, ...merged },
        { onConflict: 'page_id' }
      );

    // Resync with DB (revert on error, replace the temp row's id on success)
    fetchVisibilities();
    return !error;
  }, [visibilities, fetchVisibilities]);

  const isPageVisibleOnDevice = useCallback((pageId: string, device: DeviceType): boolean => {
    const entry = visibilities.find(v => v.page_id === pageId);
    if (!entry) return true; // Default visible if no config

    switch (device) {
      case 'desktop': return entry.visible_on_desktop;
      case 'tablet': return entry.visible_on_tablet;
      case 'mobile': return entry.visible_on_mobile;
      default: return true;
    }
  }, [visibilities]);

  return {
    visibilities,
    isLoading,
    updateVisibility,
    isPageVisibleOnDevice,
    refetch: fetchVisibilities,
  };
}
