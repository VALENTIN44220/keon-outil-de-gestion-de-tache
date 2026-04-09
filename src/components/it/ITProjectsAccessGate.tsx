import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';

/**
 * Accès module IT : écran « Projets IT » + permission fonctionnelle « Voir ».
 */
export function ITProjectsAccessGate({ children }: { children: React.ReactNode }) {
  const { effectivePermissions, isLoading } = useEffectivePermissions();

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!effectivePermissions.can_access_it_projects || !effectivePermissions.can_view_it_projects) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
