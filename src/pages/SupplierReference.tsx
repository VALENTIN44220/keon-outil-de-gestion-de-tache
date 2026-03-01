import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { useSupplierAccess } from '@/hooks/useSupplierAccess';
import { SupplierListView } from '@/components/suppliers/SupplierListView';
import { SupplierDetailDrawer } from '@/components/suppliers/SupplierDetailDrawer';
import { SupplierSynthesisModal } from '@/components/suppliers/SupplierSynthesisModal';
import { Loader2 } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';

export default function SupplierReference() {
  const { effectivePermissions, isLoading: permLoading } = useEffectivePermissions();
  const { supplierPermissions, isLoading: accessLoading } = useSupplierAccess();
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [synthesisOpen, setSynthesisOpen] = useState(false);
  const [activeView, setActiveView] = useState('suppliers');

  const handleOpenSupplier = (id: string) => {
    setSelectedSupplierId(id);
    setDrawerOpen(true);
  };

  const handleViewSupplier = (id: string) => {
    setSelectedSupplierId(id);
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
      <main className="flex-1 overflow-auto p-6">
        <SupplierListView
          onOpenSupplier={handleOpenSupplier}
          onViewSupplier={handleViewSupplier}
          canEdit={supplierPermissions.canEdit}
        />
      </main>

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
