/**
 * useITRequests — liste des demandes IT.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ITRequest {
  id: string;
  title: string;
  description: string | null;
  status: string;
  assignee_id: string | null;
  requester_id: string | null;
  source_process_template_id: string | null;
  created_at: string;
  updated_at: string;
  due_date: string | null;
  module_data: Record<string, any> | null;
}

export const IT_PRESTATIONS = [
  { id: '11111111-1111-4111-8111-111111111301', name: 'Ouverture dossier SharePoint' },
  { id: '11111111-1111-4111-8111-111111111302', name: 'Support Divalto' },
  { id: '11111111-1111-4111-8111-111111111303', name: 'Support Pipedrive' },
  { id: '11111111-1111-4111-8111-111111111304', name: 'Support Lucca' },
  { id: '11111111-1111-4111-8111-111111111305', name: 'Reporting Power BI' },
  { id: '11111111-1111-4111-8111-111111111306', name: "Demande d'intervention IT" },
  { id: '11111111-1111-4111-8111-111111111307', name: 'Support matériel bureautique' },
];

export function useITRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ITRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('module_code', 'it' as any)
        .eq('type', 'request')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRequests((data || []) as ITRequest[]);
    } catch (e) {
      console.error('useITRequests:', e);
      toast.error('Erreur chargement demandes IT');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { void fetchRequests(); }, [fetchRequests]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`it-live-${user.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: 'module_code=eq.it' },
        () => { void fetchRequests(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, fetchRequests]);

  return { requests, isLoading, refetch: fetchRequests };
}
