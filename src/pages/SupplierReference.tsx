import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useSupplierAccess } from '@/hooks/useSupplierAccess';
import { SupplierListView } from '@/components/suppliers/SupplierListView';
import { SupplierDetailDrawer } from '@/components/suppliers/SupplierDetailDrawer';
import { Loader2 } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';

export default function SupplierReference() {
  const { hasAccess, role, isLoading: accessLoading } = useSupplierAccess();
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeView, setActiveView] = useState('suppliers');

  const handleOpenSupplier = (id: string) => {
    setSelectedSupplierId(id);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedSupplierId(null);
  };

  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <main className="flex-1 overflow-auto p-6">
        <SupplierListView onOpenSupplier={handleOpenSupplier} />
      </main>

      <SupplierDetailDrawer
        supplierId={selectedSupplierId}
        open={drawerOpen}
        onClose={handleCloseDrawer}
        canEdit={role === 'achat'}
      />
    </div>
  );
}
