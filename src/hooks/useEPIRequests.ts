import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { EPIRequest } from '@/types/epi';

const TERMINAL_STATUSES = ['done', 'cancelled', 'refused'] as const;

let _instanceCounter = 0;

export function useEPIRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<EPIRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const instanceId = useRef(++_instanceCounter);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('epi_requests_overview' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const parsed = ((data || []) as unknown as EPIRequest[]).map(r => ({
        ...r,
        montant_total: Number(r.montant_total) || 0,
        nb_lignes: Number(r.nb_lignes) || 0,
      }));
      setRequests(parsed);
    } catch (e) {
      console.error('useEPIRequests:', e);
      toast.error('Erreur chargement demandes EPI');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    if (!user) return;
    const channelName = `epi-live-${user.id}-${instanceId.current}`;
    const ch = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: 'module_code=eq.epi' }, () => {
        void fetchRequests();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'epi_demande_lignes' }, () => {
        void fetchRequests();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, fetchRequests]);

  return {
    requests,
    isLoading,
    refetch: fetchRequests,
    TERMINAL_STATUSES,
  };
}
