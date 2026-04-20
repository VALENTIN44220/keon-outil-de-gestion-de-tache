import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';

/**
 * Code projet dans l'URL des hubs `/it/projects/:code/...`.
 * Même contrainte que `useBEProjectHubCode` avec PersistentRoutes.
 * Les segments statiques (`import-fdr`) sont exclus pour ne pas être pris pour un code.
 */
export function useITProjectHubCode(): string | undefined {
  const { code: paramCode } = useParams<{ code: string }>();
  const { pathname } = useLocation();

  return useMemo(() => {
    const fromParam = typeof paramCode === 'string' ? paramCode.trim() : '';
    if (fromParam) return fromParam;

    const patterns = [
      /^\/it\/projects\/([^/]+)\/overview/,
      /^\/it\/projects\/([^/]+)\/tasks/,
      /^\/it\/projects\/([^/]+)\/timeline/,
      /^\/it\/projects\/([^/]+)\/budget/,
      /^\/it\/projects\/([^/]+)\/sync/,
      /^\/it\/projects\/([^/]+)\/discussions/,
      /^\/it\/projects\/([^/]+)\/files/,
    ];
    for (const re of patterns) {
      const m = pathname.match(re);
      const seg = m?.[1];
      if (!seg || seg === 'import-fdr') continue;
      try {
        const decoded = decodeURIComponent(seg).trim();
        if (decoded) return decoded;
      } catch {
        const t = seg.trim();
        if (t) return t;
      }
    }
    return undefined;
  }, [paramCode, pathname]);
}
