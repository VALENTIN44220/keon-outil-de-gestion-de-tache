import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { useSupplierAccess } from '@/hooks/useSupplierAccess';
import { useUserRole } from '@/hooks/useUserRole';
import { SupplierListView } from '@/components/suppliers/SupplierListView';
import { SupplierDetailDrawer } from '@/components/suppliers/SupplierDetailDrawer';
import { SupplierSynthesisModal } from '@/components/suppliers/SupplierSynthesisModal';
import { Loader2, Sparkles, ChevronRight } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SERVICE_ACHAT_NOUVEAU_FOURNISSEUR_PATH } from '@/lib/supplierRequestFlow';

export default function SupplierReference() {
  const navigate = useNavigate();
  const { effectivePermissions, isLoading: permLoading } = useEffectivePermissions();
  const { supplierPermissions, isLoading: accessLoading } = useSupplierAccess();
  const { isAdmin } = useUserRole();
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [synthesisOpen, setSynthesisOpen] = useState(false);
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
            <Button
              className={cn(
                'w-full sm:w-auto min-w-[280px] h-10 font-medium shadow-md transition-all',
                'hover:shadow-lg hover:scale-[1.02]',
                'bg-violet-500 hover:bg-violet-600 text-white',
              )}
              onClick={() => navigate(SERVICE_ACHAT_NOUVEAU_FOURNISSEUR_PATH)}
            >
              <Sparkles className="h-4 w-4 mr-2 shrink-0" />
              Demande de nouveau fournisseur
              <ChevronRight className="h-4 w-4 ml-auto shrink-0" />
            </Button>
          )}
        </PageHeader>
        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          <SupplierListView
            onOpenSupplier={handleOpenSupplier}
            onViewSupplier={handleViewSupplier}
            canEdit={supplierPermissions.canEdit}
            isAdmin={isAdmin}
            persistColumnOrderToProfile
          />
        </main>
      </div>

      <SupplierDetailDrawer
        supplierId={selectedSupplierId}
        open={drawerOpen}
        onClose={handleCloseDrawer}
        canEdit={supplierPermissions.canEdit}
      />

      <SupplierSynthesisModal
        supplierId={selectedSupplierId}
        open={synthesisOpen}
        onClose={handleCloseSynthesis}
      />
    </div>
  );
}
