/**
 * useClientRequests — demandes de création client (module_code='client').
 * Flux séquentiel : Contrôle CRM → Contrôle Compta → Création affaire.
 * Les étapes (sous-tâches) sont spawnées au fil des validations côté DB.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const CLIENT_PROCESS_ID = '44444444-4444-4444-8444-000000000001';

export interface ClientStep {
  id: string;
  title: string;
  status: string;
  assignee_id: string | null;
  group_assignee_ids: string[] | null;
  order_index: number;
  assigneeLabel: string;
}

export interface ClientRequest {
  task_id: string;
  title: string;
  status: string;
  requester_id: string | null;
  created_at: string;
  updated_at: string;
  module_data: Record<string, any> | null;
  steps: ClientStep[];
  /** étape active (1re non terminée) pour l'affichage. */
  currentStepLabel: string;
  nb_etapes: number;
  nb_terminees: number;
}

const DONE = ['done', 'validated', 'realisee', 'cloturee'];
const REFUSED = ['refused', 'cancelled'];

const STEP_ORDER_BY_SP: Record<string, number> = {
  '44444444-4444-4444-8444-000000000101': 0,
  '44444444-4444-4444-8444-000000000102': 1,
  '44444444-4444-4444-8444-000000000103': 2,
};

export function useClientRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data: reqs, error } = await supabase
        .from('tasks')
        .select('id, title, status, requester_id, created_at, updated_at, module_data')
        .eq('type', 'request')
        .eq('module_code', 'client')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const ids = (reqs ?? []).map(r => r.id);
      const stepsByParent = new Map<string, ClientStep[]>();
      if (ids.length > 0) {
        const { data: children } = await supabase
          .from('tasks')
          .select('id, title, status, assignee_id, group_assignee_ids, parent_request_id, source_sub_process_template_id')
          .in('parent_request_id', ids);

        const pids = new Set<string>();
        for (const c of children ?? []) {
          if (c.assignee_id) pids.add(c.assignee_id);
          for (const g of ((c as any).group_assignee_ids as string[] | null) ?? []) pids.add(g);
        }
        const nameById = new Map<string, string>();
        if (pids.size > 0) {
          const { data: profs } = await supabase.from('profiles').select('id, display_name').in('id', Array.from(pids));
          for (const p of profs ?? []) nameById.set(p.id, p.display_name ?? '—');
        }
        const labelFor = (a: string | null, g: string[] | null) =>
          a ? (nameById.get(a) ?? '—')
            : (g && g.length > 0 ? 'Équipe : ' + g.map(id => nameById.get(id) ?? '—').join(', ') : 'À affecter');

        for (const c of children ?? []) {
          const group = ((c as any).group_assignee_ids as string[] | null) ?? null;
          const list = stepsByParent.get(c.parent_request_id!) ?? [];
          list.push({
            id: c.id, title: c.title, status: c.status,
            assignee_id: c.assignee_id, group_assignee_ids: group,
            order_index: STEP_ORDER_BY_SP[c.source_sub_process_template_id ?? ''] ?? 99,
            assigneeLabel: labelFor(c.assignee_id, group),
          });
          stepsByParent.set(c.parent_request_id!, list);
        }
      }

      setRequests((reqs ?? []).map(r => {
        const steps = (stepsByParent.get(r.id) ?? []).sort((a, b) => a.order_index - b.order_index);
        const active = steps.find(s => !DONE.includes(s.status) && !REFUSED.includes(s.status));
        return {
          task_id: r.id, title: r.title, status: r.status,
          requester_id: r.requester_id, created_at: r.created_at, updated_at: r.updated_at,
          module_data: (r.module_data as Record<string, any> | null) ?? null,
          steps,
          currentStepLabel: active
            ? active.title.split(' — ').pop() ?? active.title
            : (steps.some(s => REFUSED.includes(s.status)) ? 'Refusée' : 'Terminée'),
          nb_etapes: steps.length,
          nb_terminees: steps.filter(s => DONE.includes(s.status)).length,
        };
      }));
    } catch (e) {
      console.error('useClientRequests:', e);
      toast.error('Erreur chargement demandes client');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { void fetchRequests(); }, [fetchRequests]);

  useEffect(() => {
    if (!user) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => { if (t) clearTimeout(t); t = setTimeout(() => void fetchRequests(), 500); };
    const ch = supabase.channel(`client-live-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: 'module_code=eq.client' }, refresh)
      .subscribe();
    return () => { if (t) clearTimeout(t); supabase.removeChannel(ch); };
  }, [user, fetchRequests]);

  return { requests, isLoading, refetch: fetchRequests };
}
