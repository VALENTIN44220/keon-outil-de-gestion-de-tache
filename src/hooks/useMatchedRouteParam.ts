import { useMemo } from 'react';
import { matchPath, useLocation, useParams } from 'react-router-dom';

/**
 * Avec `PersistentRoutes`, les écrans ne sont pas rendus comme enfants d'un `<Route>`,
 * donc `useParams()` reste souvent vide. On complète avec `matchPath` sur l'URL courante.
 */
export function useMatchedRouteParam(
  paramName: string,
  pathPattern: string,
  end = true,
): string | undefined {
  const routeParams = useParams();
  const location = useLocation();
  const fromHook = routeParams[paramName];

  return useMemo(() => {
    if (typeof fromHook === 'string' && fromHook.length > 0) {
      return fromHook;
    }
    const m = matchPath({ path: pathPattern, end }, location.pathname);
    const v = m?.params[paramName];
    return typeof v === 'string' && v.length > 0 ? v : undefined;
  }, [end, fromHook, location.pathname, paramName, pathPattern]);
}
