import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { AdminHeader } from '@/components/layout/AdminHeader';
import { useUserRole } from '@/hooks/useUserRole';
import { usePermissionsContext } from '@/contexts/PermissionsContext';
import { QuestionnaireAdminTab } from '@/components/admin/questionnaire/QuestionnaireAdminTab';

/**
 * Page dédiée à la gestion de la structure des questionnaires.
 * Accessible aux administrateurs ET aux porteurs de la permission
 * `can_manage_questionnaire` (sans donner accès au reste de l'admin).
 */
export default function Questionnaires() {
  const [activeView, setActiveView] = useState('questionnaires');
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { effectivePermissions, isLoading: permsLoading } = usePermissionsContext();

  if (roleLoading || permsLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const canManage = isAdmin || effectivePermissions.can_manage_questionnaire === true;
  if (!canManage) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader
          title="Questionnaires SPV"
          subtitle="Sections, sous-sections et champs — déployés sur toutes les SPV"
        />

        <main className="flex-1 overflow-auto overflow-x-hidden p-3 sm:p-6">
          <QuestionnaireAdminTab />
        </main>
      </div>
    </div>
  );
}
