import { useState, useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { useSupplierAccess } from '@/hooks/useSupplierAccess';
import { useUserRole } from '@/hooks/useUserRole';
import { useSupplierValidationRole } from '@/hooks/useSupplierValidationRole';
import { SupplierListView } from '@/components/suppliers/SupplierListView';
import { SupplierDetailDrawer } from '@/components/suppliers/SupplierDetailDrawer';
import { SupplierSynthesisModal } from '@/components/suppliers/SupplierSynthesisModal';
import { NewSupplierRequestDialog } from '@/components/suppliers/NewSupplierRequestDialog';
import { SupplierWaitingApprovalListDialog } from '@/components/suppliers/SupplierWaitingApprovalListDialog';
import { MySupplierRequestsDialog } from '@/components/suppliers/MySupplierRequestsDialog';
import { Clock, Loader2, Sparkles, ListChecks, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Sidebar } from '@/components/layout/Sidebar';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
export default function SupplierReference() {
  const { effectivePermissions, isLoading: permLoading } = useEffectivePermissions();
  const { supplierPermissions, role: supplierRole, isLoading: accessLoading } = useSupplierAccess();
  const { isAdmin } = useUserRole();
  const { data: validationRole = 'none' } = useSupplierValidationRole();
  const location = useLocation();
  const navigate = useNavigate();

  const canManageValidations = validationRole !== 'none';

  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [synthesisOpen, setSynthesisOpen] = useState(false);
  const [newSupplierDialogOpen, setNewSupplierDialogOpen] = useState(false);
  const [waitingApprovalListOpen, setWaitingApprovalListOpen] = useState(false);
  const [myRequestsOpen, setMyRequestsOpen] = useState(false);
  const [myRequestsAutoId, setMyRequestsAutoId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState('suppliers');
  const [isSyncingDivalto, setIsSyncingDivalto] = useState(false);

  // Synchronisation manuelle des fournisseurs Divalto vers la table
  // d'enrichissement. Le cron tourne déjà à 7h30 UTC tous les jours, mais
  // cet bouton permet aux admins Achats de forcer une synchro à la demande.
  const handleSyncDivalto = async () => {
    setIsSyncingDivalto(true);
    try {
      const { data, error } = await supabase
        .rpc('sync_divalto_suppliers_to_enrichment') as { data: { inserted_count: number; total_distinct_divalto: number }[] | null; error: any };
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : null;
      const inserted = row?.inserted_count ?? 0;
      const total = row?.total_distinct_divalto ?? 0;
      toast({
        title: inserted > 0 ? `${inserted} nouveau${inserted > 1 ? 'x' : ''} fournisseur${inserted > 1 ? 's' : ''} importé${inserted > 1 ? 's' : ''}` : 'Aucun nouveau fournisseur',
        description: `${total} tiers distincts dans Divalto au total.${inserted > 0 ? ' Rafraîchis la page pour les voir.' : ''}`,
      });
    } catch (e: any) {
      toast({
        title: 'Erreur de synchronisation',
        description: e?.message || 'Échec de la fonction sync_divalto_suppliers_to_enrichment',
        variant: 'destructive',
      });
    } finally {
      setIsSyncingDivalto(false);
    }
  };

  // Ouvre la bonne dialog selon les query params (depuis une notification cliquée)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    let handled = false;

    if (params.get('myRequests') === 'true') {
      setMyRequestsAutoId(params.get('requestId') ?? null);
      setMyRequestsOpen(true);
      handled = true;
    }

    if (params.get('openWaiting') === 'true') {
      setWaitingApprovalListOpen(true);
      handled = true;
    }

    if (handled) {
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

            {/* Synchroniser depuis Divalto — admins uniquement.
                Un cron tourne déjà à 7h30 UTC chaque jour, ce bouton sert
                de filet pour les cas urgents (nouveau fournisseur urgent). */}
            {isAdmin && (
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto h-10 font-medium border-amber-200 text-amber-700 hover:bg-amber-50"
                onClick={handleSyncDivalto}
                disabled={isSyncingDivalto}
                title="Importer les nouveaux fournisseurs Divalto manquants"
              >
                {isSyncingDivalto ? (
                  <Loader2 className="h-4 w-4 mr-2 shrink-0 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2 shrink-0" />
                )}
                Synchroniser depuis Divalto
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
        canDelete={supplierPermissions.canDelete}
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
