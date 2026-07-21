/**
 * useJuridiqueRequests — demandes du service Juridique.
 *
 * Modèle simple (MVP) : une demande = une tâche traçable (type=request,
 * module_code='juridique'), sans sous-tâches. Le métier est porté par
 * module_data (prestation, projet BE, contrat fournisseur, charge estimée…).
 * Affectation par le service juridique via assignee_id.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/** Prestations juridiques (sous-types de demande). */
export const JURIDIQUE_PRESTATIONS = [
  'contrat',
  'contrat_fournisseur',
  'pacte_gouvernance',
  'secretariat',
  'instance',
  'capital',
  'contentieux',
  'veille',
  'conseil',
  'autre',
] as const;

export type JuridiquePrestation = typeof JURIDIQUE_PRESTATIONS[number];

export const JURIDIQUE_PRESTATION_LABELS: Record<JuridiquePrestation, string> = {
  contrat: 'Rédaction / relecture de contrat',
  contrat_fournisseur: 'Contrat fournisseur',
  pacte_gouvernance: "Pacte d'associés / gouvernance SPV",
  secretariat: 'Secrétariat juridique (registres, formalités)',
  instance: 'Comité / AG / CODIR (PV, convocations)',
  capital: 'Cession / augmentation de capital',
  contentieux: 'Contentieux / litige',
  veille: 'Veille légale & réglementaire',
  conseil: 'Conseil juridique (question ad hoc)',
  autre: 'Autre',
};

/** Membres du service juridique (affectation). */
export const JURIDIQUE_MEMBERS = [
  { id: 'f46a0644-e97f-4120-8f60-36bc63f4c249', name: 'COUZY Sébastien' },
  { id: '542442c7-bb0b-4157-a34e-6a8053c05234', name: 'VERNEY Marie' },
] as const;

export const JURIDIQUE_MEMBER_IDS: string[] = JURIDIQUE_MEMBERS.map(m => m.id);

export interface JuridiqueRequest {
  task_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  prestation: JuridiquePrestation | null;
  requester_id: string | null;
  assignee_id: string | null;
  created_at: string;
  updated_at: string;
  due_date: string | null;
  duration_hours: number | null;
  module_data: Record<string, any> | null;
  // Confort d'affichage
  projet_label: string | null;
  fournisseur_label: string | null;
}

export const JURIDIQUE_TERMINAL_STATUSES = ['done', 'cancelled'];

export function useJuridiqueRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<JuridiqueRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data: reqs, error } = await supabase
        .from('tasks')
        .select('id, title, description, status, priority, requester_id, assignee_id, created_at, updated_at, due_date, duration_hours, module_data')
        .eq('type', 'request')
        .eq('module_code', 'juridique' as any)
        .order('created_at', { ascending: false });
      if (error) throw error;

      setRequests((reqs ?? []).map((r: any) => {
        const d = (r.module_data as Record<string, any> | null) ?? {};
        return {
          task_id: r.id,
          title: r.title,
          description: r.description ?? null,
          status: r.status,
          priority: r.priority ?? null,
          prestation: (d.prestation as JuridiquePrestation) ?? null,
          requester_id: r.requester_id,
          assignee_id: r.assignee_id,
          created_at: r.created_at,
          updated_at: r.updated_at,
          due_date: r.due_date,
          duration_hours: r.duration_hours ?? null,
          module_data: d,
          projet_label: d.projet_label ?? null,
          fournisseur_label: d.fournisseur_nom
            ? `${d.fournisseur_nom} (${d.fournisseur_tiers ?? ''})`.replace(' ()', '')
            : (d.fournisseur_tiers ?? null),
        } as JuridiqueRequest;
      }));
    } catch (e) {
      console.error('useJuridiqueRequests:', e);
      toast.error('Erreur chargement demandes juridiques');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  // Realtime sur les demandes juridiques
  useEffect(() => {
    if (!user) return;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => void fetchRequests(), 500);
    };
    const ch = supabase
      .channel(`juridique-live-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: 'module_code=eq.juridique' }, scheduleRefresh)
      .subscribe();
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(ch);
    };
  }, [user, fetchRequests]);

  return { requests, isLoading, refetch: fetchRequests };
}
