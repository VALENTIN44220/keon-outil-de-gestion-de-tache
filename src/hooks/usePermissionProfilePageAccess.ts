/**
 * usePermissionProfilePageAccess — niveau d'accès par page pour un profil de permission.
 *
 * 3 niveaux par page :
 *   - 'none'  : page non visible dans le menu
 *   - 'read'  : page visible en lecture seule
 *   - 'write' : page visible en lecture + écriture (défaut)
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type PageAccessLevel = 'none' | 'read' | 'write';

export interface PageAccessEntry {
  profile_id: string;
  page_id: string;
  access_level: PageAccessLevel;
}

export interface PageDef {
  page_id: string;
  page_label: string;
}

/** Liste de toutes les pages connues (catalogue) — depuis page_device_visibility */
export function usePagesCatalog() {
  const [pages, setPages] = useState<PageDef[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    void supabase.from('page_device_visibility').select('page_id, page_label').order('page_label')
      .then(({ data }) => {
        setPages((data ?? []) as PageDef[]);
        setIsLoading(false);
      });
  }, []);
  return { pages, isLoading };
}

/** Niveaux d'accès pour un profil donné. Map page_id → level. */
export function usePermissionProfilePageAccess(profileId: string | null) {
  const [accessMap, setAccessMap] = useState<Record<string, PageAccessLevel>>({});
  const [isLoading, setIsLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!profileId) { setAccessMap({}); return; }
    setIsLoading(true);
    const { data } = await supabase
      .from('permission_profile_page_access' as any)
      .select('page_id, access_level')
      .eq('profile_id', profileId);
    const m: Record<string, PageAccessLevel> = {};
    for (const r of (data ?? []) as Array<{ page_id: string; access_level: PageAccessLevel }>) {
      m[r.page_id] = r.access_level;
    }
    setAccessMap(m);
    setIsLoading(false);
  }, [profileId]);

  useEffect(() => { void reload(); }, [reload]);

  const setLevel = useCallback(async (pageId: string, level: PageAccessLevel) => {
    if (!profileId) return;
    setAccessMap(prev => ({ ...prev, [pageId]: level }));
    const { error } = await supabase
      .from('permission_profile_page_access' as any)
      .upsert(
        { profile_id: profileId, page_id: pageId, access_level: level },
        { onConflict: 'profile_id,page_id' }
      );
    if (error) {
      // Revert
      void reload();
    }
  }, [profileId, reload]);

  const setLevelMany = useCallback(async (entries: Array<{ pageId: string; level: PageAccessLevel }>) => {
    if (!profileId || entries.length === 0) return;
    setAccessMap(prev => {
      const next = { ...prev };
      for (const e of entries) next[e.pageId] = e.level;
      return next;
    });
    const rows = entries.map(e => ({ profile_id: profileId, page_id: e.pageId, access_level: e.level }));
    const { error } = await supabase
      .from('permission_profile_page_access' as any)
      .upsert(rows, { onConflict: 'profile_id,page_id' });
    if (error) void reload();
  }, [profileId, reload]);

  return { accessMap, isLoading, setLevel, setLevelMany, refetch: reload };
}
