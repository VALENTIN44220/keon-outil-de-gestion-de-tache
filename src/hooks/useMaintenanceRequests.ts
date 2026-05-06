/**
 * useMaintenanceRequests — lit la vue agregee maintenance_requests_overview
 * (1 ligne par demande + lignes d articles JSON + etat global).
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface MaintenanceRequestLine {
  id: string;
  ref: string;
  des: string;
  quantite: number;
  etat_commande: string;
}

export interface MaintenanceRequest {
  task_id: string;
  title: string;
  status: string;
  assignee_id: string | null;
  requester_id: string | null;
  created_at: string;
  updated_at: string;
  due_date: string | null;
  module_data: Record<string, any> | null;
  lignes: MaintenanceRequestLine[];
  nb_lignes: number;
  qte_totale: number;
  etat_global: string | null;
}

const ETATS_COMMANDE = [
  'En attente validation',
  'Demande de devis',
  'Bon de commande envoyé',
  'AR reçu',
  'Commande livrée',
  'Commande distribuée',
] as const;

const TERMINAL_STATUSES = ['cloturee', 'realisee', 'cancelled', 'refused'] as const;

export function useMaintenanceRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('maintenance_requests_overview' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data || []) as unknown as MaintenanceRequest[]);
    } catch (e) {
      console.error('useMaintenanceRequests:', e);
      toast.error('Erreur chargement demandes maintenance');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  // Realtime sur tasks (filtre maintenance) et demande_materiel
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`maintenance-live-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: 'module_code=eq.maintenance' }, () => {
        void fetchRequests();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'demande_materiel' }, () => {
        void fetchRequests();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, fetchRequests]);

  return {
    requests,
    isLoading,
    refetch: fetchRequests,
    ETATS_COMMANDE,
    TERMINAL_STATUSES,
  };
}
