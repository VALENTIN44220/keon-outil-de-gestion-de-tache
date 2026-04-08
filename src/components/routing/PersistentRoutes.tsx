import { ReactNode, useEffect, useMemo, useState } from 'react';
import { matchPath, useLocation } from 'react-router-dom';

type PersistentRoute = {
  /** Path pattern (use exact paths like "/projects"). */
  path: string;
  /** If false, the route stays active for nested paths (e.g. "/templates/*"). */
  end?: boolean;
  /** Rendered screen (usually wrapped in ProtectedRoute). */
  element: ReactNode;
};

/**
 * Keeps selected route screens mounted across navigation.
 *
 * React Router normally unmounts a page component when you leave its route, which resets local state
 * (draft inputs, scroll position, filters...). This component renders those screens all the time
 * and just hides inactive ones.
 *
 * Important: you must also define matching <Route path="..."> placeholders in <Routes>
 * so the catch-all "*" route doesn't render on those paths.
 */
export function PersistentRoutes({ routes }: { routes: PersistentRoute[] }) {
  const location = useLocation();

  const activePath = location.pathname;
  const activeIndex = useMemo(() => {
    return routes.findIndex((r) =>
      matchPath({ path: r.path, end: r.end ?? true }, activePath),
    );
  }, [activePath, routes]);

  // Cache visited routes to avoid mounting every page on first load.
  // Once visited, the screen stays mounted and preserves its React state.
  const [visited, setVisited] = useState<boolean[]>(() => routes.map(() => false));

  useEffect(() => {
    if (activeIndex < 0) return;
    setVisited((prev) => {
      if (prev[activeIndex]) return prev;
      const next = [...prev];
      next[activeIndex] = true;
      return next;
    });
  }, [activeIndex]);

  return (
    <>
      {routes.map((r, idx) => {
        const isActive = idx === activeIndex;
        const isVisited = visited[idx];
        if (!isVisited && !isActive) return null;
        return (
          <div
            key={r.path}
            style={{ display: isActive ? 'block' : 'none' }}
            aria-hidden={!isActive}
            data-persistent-route={r.path}
          >
            {r.element}
          </div>
        );
      })}
    </>
  );
}

