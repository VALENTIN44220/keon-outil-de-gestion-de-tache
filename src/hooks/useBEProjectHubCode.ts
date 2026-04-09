import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';

/**
 * Code projet dans l’URL des hubs `/be/projects/:code/...` et `/spv/projects/:code/...`.
 *
 * Avec `PersistentRoutes`, les écrans ne sont pas rendus comme enfants d’un `<Route>` React Router,
 * donc `useParams()` reste souvent vide. On complète en parsant `location.pathname`.
 */
export function useBEProjectHubCode(): string | undefined {
  const { code: paramCode } = useParams<{ code: string }>();
  const { pathname } = useLocation();

  return useMemo(() => {
    const fromParam = typeof paramCode === 'string' ? paramCode.trim() : '';
    if (fromParam) return fromParam;

    const spv = pathname.match(/^\/spv\/projects\/([^/]+)(?:\/|$)/);
    const be = pathname.match(/^\/be\/projects\/([^/]+)(?:\/|$)/);
    const seg = spv?.[1] ?? be?.[1];
    if (!seg) return undefined;
    try {
      const decoded = decodeURIComponent(seg).trim();
      return decoded || undefined;
    } catch {
      return seg.trim() || undefined;
    }
  }, [paramCode, pathname]);
}
