import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { useSupplierAccess } from '@/hooks/useSupplierAccess';
import { useUserRole } from '@/hooks/useUserRole';
import { SupplierListView } from '@/components/suppliers/SupplierListView';
import { SupplierDetailDrawer } from '@/components/suppliers/SupplierDetailDrawer';
import { SupplierSynthesisModal } from '@/components/suppliers/SupplierSynthesisModal';
import { NewSupplierRequestDialog } from '@/components/suppliers/NewSupplierRequestDialog';
import { SupplierWaitingApprovalListDialog } from '@/components/suppliers/SupplierWaitingApprovalListDialog';
import { Clock, Loader2, Sparkles } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
export default function SupplierReference() {
  const { effectivePermissions, isLoading: permLoading } = useEffectivePermissions();
  const { supplierPermissions, role: supplierRole, isLoading: accessLoading } = useSupplierAccess();
  const { isAdmin } = useUserRole();
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [synthesisOpen, setSynthesisOpen] = useState(false);
  const [newSupplierDialogOpen, setNewSupplierDialogOpen] = useState(false);
  const [waitingApprovalListOpen, setWaitingApprovalListOpen] = useState(false);
  const [activeView, setActiveView] = useState('suppliers');

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
          {effectivePermissions.can_access_requests && (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                type="button"
                className={cn(
                  'w-full sm:w-auto min-w-[280px] h-10 font-medium shadow-md transition-all',
                  'hover:shadow-lg hover:scale-[1.02]',
                  'bg-violet-500 hover:bg-violet-600 text-white',
                )}
                onClick={() => setNewSupplierDialogOpen(true)}
              >
                <Sparkles className="h-4 w-4 mr-2 shrink-0" />
                Demande de nouveau fournisseur
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto min-w-[280px] h-10 font-medium"
                onClick={() => setWaitingApprovalListOpen(true)}
              >
                <Clock className="h-4 w-4 mr-2 shrink-0" />
                Fournisseur en attente d&apos;approbation
              </Button>
            </div>
          )}
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
    </div>
  );
}
