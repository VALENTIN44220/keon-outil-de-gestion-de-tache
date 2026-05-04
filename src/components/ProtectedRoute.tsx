import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Lightweight per-route guard.
 *
 * The heavy profile bootstrap (DB lookup, Microsoft account linking, stub insert) lives in
 * <AuthGate> mounted once at the app root — doing it here caused a spinner flash on every
 * first-visit navigation because <PersistentRoutes> mounts a fresh <ProtectedRoute> per page.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
