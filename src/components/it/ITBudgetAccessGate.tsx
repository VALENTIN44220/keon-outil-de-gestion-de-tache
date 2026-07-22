import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';

/**
 * Accès à la page Budget IT (dont l'onglet RH / coûts salariaux) :
 * réservé aux utilisateurs disposant de la permission `can_access_it_budget`.
 * Corrige l'incohérence où la route n'était gardée que par l'accès Projets IT.
 */
export function ITBudgetAccessGate({ children }: { children: React.ReactNode }) {
  const { effectivePermissions, isLoading } = useEffectivePermissions();

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!effectivePermissions.can_access_it_budget) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
