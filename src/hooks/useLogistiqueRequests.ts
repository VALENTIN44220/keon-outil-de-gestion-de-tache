/**
 * useLogistiqueRequests — liste des demandes de transport (module=logistique).
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface LogistiqueRequest {
  id: string;
  title: string;
  description: string | null;
  status: string;
  assignee_id: string | null;
  requester_id: string | null;
  created_at: string;
  updated_at: string;
  due_date: string | null;
  module_data: Record<string, any> | null;
}

export const LOG_STATUSES = [
  'soumise',
  'devis_a_chiffrer',          // demande de devis créée, en attente de chiffrage
  'devis_a_valider',           // chiffré, en attente de décision du demandeur
  'affectee',
  'planifiee',
  'en_enlevement',
  'en_livraison',
  'livree',
  'cloturee',
  'complement_demande',
  'abandonnee',
] as const;

export const LOG_TERMINAL = ['cloturee', 'abandonnee'];

export function useLogistiqueRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<LogistiqueRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('module_code', 'logistique' as any)
        .eq('type', 'request')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data || []) as LogistiqueRequest[]);
    } catch (e) {
      console.error('useLogistiqueRequests:', e);
      toast.error('Erreur chargement demandes logistique');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { void fetchRequests(); }, [fetchRequests]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`logistique-live-${user.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: 'module_code=eq.logistique' },
        () => { void fetchRequests(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, fetchRequests]);

  return { requests, isLoading, refetch: fetchRequests };
}
