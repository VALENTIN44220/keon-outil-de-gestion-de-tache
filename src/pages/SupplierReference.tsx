import { useState, useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { useSupplierAccess } from '@/hooks/useSupplierAccess';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { supplierWaitingValidationRoleFromProfileName, extractPermissionProfileName } from '@/lib/supplierWaitingValidationRole';
import { SupplierListView } from '@/components/suppliers/SupplierListView';
import { SupplierDetailDrawer } from '@/components/suppliers/SupplierDetailDrawer';
import { SupplierSynthesisModal } from '@/components/suppliers/SupplierSynthesisModal';
import { NewSupplierRequestDialog } from '@/components/suppliers/NewSupplierRequestDialog';
import { SupplierWaitingApprovalListDialog } from '@/components/suppliers/SupplierWaitingApprovalListDialog';
import { MySupplierRequestsDialog } from '@/components/suppliers/MySupplierRequestsDialog';
import { Clock, Loader2, Sparkles, ListChecks } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
export default function SupplierReference() {
  const { effectivePermissions, isLoading: permLoading } = useEffectivePermissions();
  const { supplierPermissions, role: supplierRole, isLoading: accessLoading } = useSupplierAccess();
  const { isAdmin } = useUserRole();
  const { profile: authProfile } = useAuth();
  const { getActiveProfile } = useSimulation();
  const location = useLocation();
  const navigate = useNavigate();

  // Profil actif (simulé ou réel) → rôle validation
  const activeProfile = getActiveProfile() ?? authProfile;
  const permProfileName = extractPermissionProfileName(activeProfile);
  const validationRole = supplierWaitingValidationRoleFromProfileName(permProfileName);
  /** Peut voir la liste d'attente et valider/refuser */
  const canManageValidations =
    isAdmin ||
    validationRole === 'achat' ||
    validationRole === 'compta' ||
    validationRole === 'hybrid';

  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [synthesisOpen, setSynthesisOpen] = useState(false);
  const [newSupplierDialogOpen, setNewSupplierDialogOpen] = useState(false);
  const [waitingApprovalListOpen, setWaitingApprovalListOpen] = useState(false);
  const [myRequestsOpen, setMyRequestsOpen] = useState(false);
  const [myRequestsAutoId, setMyRequestsAutoId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState('suppliers');

  // Ouvre "Mes demandes" si l'URL contient ?myRequests=true (depuis une notification)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('myRequests') === 'true') {
      setMyRequestsAutoId(params.get('requestId') ?? null);
      setMyRequestsOpen(true);
      // Nettoie l'URL sans rechargement
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, location.pathname, navigate]);

  const handleOpenSupplier = (id: string) => {
    setSelectedSupplierId(id);
    setSynthesisOpen(false);
    setDrawerOpen(true);
  };

  const handleViewSupplier = (id: string) => {
    setSelectedSupplierId(id);
    setDrawerOpen(false);
    setSynthesisOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedSupplierId(null);
  };

  const handleCloseSynthesis = () => {
    setSynthesisOpen(false);
    setSelectedSupplierId(null);
  };

  if (permLoading || accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!effectivePermissions.can_access_suppliers && !supplierPermissions.canView) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <PageHeader title="Référentiel Fournisseurs" subtitle="Service Achats">
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {/* Soumettre une demande — tous les utilisateurs avec can_access_requests */}
            {effectivePermissions.can_access_requests && (
              <Button
                type="button"
                className={cn(
                  'w-full sm:w-auto min-w-[260px] h-10 font-medium shadow-md transition-all',
                  'hover:shadow-lg hover:scale-[1.02]',
                  'bg-violet-500 hover:bg-violet-600 text-white',
                )}
                onClick={() => setNewSupplierDialogOpen(true)}
              >
                <Sparkles className="h-4 w-4 mr-2 shrink-0" />
                Demande de nouveau fournisseur
              </Button>
            )}

            {/* Liste d'attente — achat, comptabilité et admin uniquement */}
            {canManageValidations && (
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto min-w-[260px] h-10 font-medium"
                onClick={() => setWaitingApprovalListOpen(true)}
              >
                <Clock className="h-4 w-4 mr-2 shrink-0" />
                Fournisseurs en attente d&apos;approbation
              </Button>
            )}

            {/* Mes demandes — tout utilisateur ayant accès à la page */}
            {(effectivePermissions.can_access_requests || supplierPermissions.canView) && (
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto h-10 font-medium"
                onClick={() => { setMyRequestsAutoId(null); setMyRequestsOpen(true); }}
              >
                <ListChecks className="h-4 w-4 mr-2 shrink-0" />
                Mes demandes
              </Button>
            )}
          </div>
        </PageHeader>
        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          <SupplierListView
            onOpenSupplier={handleOpenSupplier}
            onViewSupplier={handleViewSupplier}
            canEdit={supplierPermissions.canEdit}
            isAdmin={isAdmin}
            supplierRole={supplierRole}
            persistColumnOrderToProfile
          />
        </main>
      </div>

      <SupplierDetailDrawer
        supplierId={selectedSupplierId}
        open={drawerOpen}
        onClose={handleCloseDrawer}
        canEdit={supplierPermissions.canEdit}
        isAdmin={isAdmin}
      />

      <SupplierSynthesisModal
        supplierId={selectedSupplierId}
        open={synthesisOpen}
        onClose={handleCloseSynthesis}
      />

      <NewSupplierRequestDialog
        open={newSupplierDialogOpen}
        onClose={() => setNewSupplierDialogOpen(false)}
      />

      <SupplierWaitingApprovalListDialog
        open={waitingApprovalListOpen}
        onClose={() => setWaitingApprovalListOpen(false)}
      />

      <MySupplierRequestsDialog
        open={myRequestsOpen}
        onClose={() => { setMyRequestsOpen(false); setMyRequestsAutoId(null); }}
        autoOpenId={myRequestsAutoId}
      />
    </div>
  );
}
