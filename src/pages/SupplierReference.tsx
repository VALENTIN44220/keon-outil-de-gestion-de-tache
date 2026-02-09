import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useSupplierAccess } from '@/hooks/useSupplierAccess';
import { SupplierListView } from '@/components/suppliers/SupplierListView';
import { SupplierDetailDrawer } from '@/components/suppliers/SupplierDetailDrawer';
import { Loader2, ArrowLeft, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';

export default function SupplierReference() {
  const { hasAccess, isLoading: accessLoading } = useSupplierAccess();
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const { profile } = useAuth();

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

  const displayName = profile?.display_name || 'Utilisateur';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span className="font-semibold">Référentiel Fournisseurs</span>
            </div>
          </div>
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
          </Avatar>
        </div>
      </header>

      <main className="p-6">
        <SupplierListView onOpenSupplier={handleOpenSupplier} />
      </main>

      <SupplierDetailDrawer
        supplierId={selectedSupplierId}
        open={drawerOpen}
        onClose={handleCloseDrawer}
      />
    </div>
  );
}
