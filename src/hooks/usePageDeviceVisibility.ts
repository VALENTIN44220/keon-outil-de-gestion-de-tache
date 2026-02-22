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

  const updateVisibility = useCallback(async (
    pageId: string,
    field: 'visible_on_desktop' | 'visible_on_tablet' | 'visible_on_mobile',
    value: boolean
  ) => {
    // Optimistic update
    setVisibilities(prev => prev.map(v => 
      v.page_id === pageId ? { ...v, [field]: value } : v
    ));

    const { error } = await supabase
      .from('page_device_visibility')
      .update({ [field]: value })
      .eq('page_id', pageId);

    if (error) {
      // Revert on error
      fetchVisibilities();
    }
  }, [fetchVisibilities]);

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
