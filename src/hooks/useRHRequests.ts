/**
 * useRHRequests — demandes RH (Onboarding / Offboarding / Mutation / Promotion).
 *
 * Lit les tasks (type=request, module_code='rh') + agrège l'avancement des
 * sous-tâches spawnnées par le trigger fn_auto_spawn_child_tasks.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const RH_PROCESS_IDS = {
  onboarding: '11111111-1111-4111-8111-111111111601',
  offboarding: '11111111-1111-4111-8111-111111111602',
  mutation: '11111111-1111-4111-8111-111111111603',
  promotion: '11111111-1111-4111-8111-111111111604',
} as const;

export type RHPrestation = keyof typeof RH_PROCESS_IDS;

export const RH_PRESTATION_LABELS: Record<RHPrestation, string> = {
  onboarding: 'Onboarding',
  offboarding: 'Offboarding',
  mutation: 'Mutation',
  promotion: 'Promotion',
};

const PROCESS_ID_TO_PRESTATION: Record<string, RHPrestation> = Object.fromEntries(
  Object.entries(RH_PROCESS_IDS).map(([k, v]) => [v, k as RHPrestation]),
) as Record<string, RHPrestation>;

export interface RHChildTask {
  id: string;
  title: string;
  status: string;
  assignee_id: string | null;
  due_date: string | null;
  source_sub_process_template_id: string | null;
}

export interface RHRequest {
  task_id: string;
  title: string;
  status: string;
  prestation: RHPrestation | null;
  requester_id: string | null;
  assignee_id: string | null;
  created_at: string;
  updated_at: string;
  due_date: string | null;
  module_data: Record<string, any> | null;
  children: RHChildTask[];
  nb_taches: number;
  nb_terminees: number;
  nb_a_valider: number;
  nb_a_affecter: number;
}

const DONE_STATUSES = ['done', 'validated'];
const PENDING_VALIDATION_STATUSES = ['pending_validation_1', 'pending_validation_2'];

export function useRHRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<RHRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data: reqs, error } = await supabase
        .from('tasks')
        .select('id, title, status, requester_id, assignee_id, created_at, updated_at, due_date, module_data, source_process_template_id')
        .eq('type', 'request')
        .eq('module_code', 'rh')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const ids = (reqs ?? []).map(r => r.id);
      let childrenByParent = new Map<string, RHChildTask[]>();
      if (ids.length > 0) {
        const { data: children, error: childErr } = await supabase
          .from('tasks')
          .select('id, title, status, assignee_id, due_date, parent_request_id, source_sub_process_template_id')
          .in('parent_request_id', ids);
        if (childErr) throw childErr;
        for (const c of children ?? []) {
          const list = childrenByParent.get(c.parent_request_id!) ?? [];
          list.push({
            id: c.id,
            title: c.title,
            status: c.status,
            assignee_id: c.assignee_id,
            due_date: c.due_date,
            source_sub_process_template_id: c.source_sub_process_template_id,
          });
          childrenByParent.set(c.parent_request_id!, list);
        }
      }

      setRequests((reqs ?? []).map(r => {
        const children = childrenByParent.get(r.id) ?? [];
        return {
          task_id: r.id,
          title: r.title,
          status: r.status,
          prestation: r.source_process_template_id
            ? PROCESS_ID_TO_PRESTATION[r.source_process_template_id] ?? null
            : null,
          requester_id: r.requester_id,
          assignee_id: r.assignee_id,
          created_at: r.created_at,
          updated_at: r.updated_at,
          due_date: r.due_date,
          module_data: (r.module_data as Record<string, any> | null) ?? null,
          children,
          nb_taches: children.length,
          nb_terminees: children.filter(c => DONE_STATUSES.includes(c.status)).length,
          nb_a_valider: children.filter(c => PENDING_VALIDATION_STATUSES.includes(c.status)).length,
          nb_a_affecter: children.filter(c => c.status === 'to_assign').length,
        };
      }));
    } catch (e) {
      console.error('useRHRequests:', e);
      toast.error('Erreur chargement demandes RH');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  // Realtime sur tasks filtrées module rh (demandes ET sous-tâches)
  useEffect(() => {
    if (!user) return;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => void fetchRequests(), 500);
    };
    const ch = supabase
      .channel(`rh-live-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: 'module_code=eq.rh' }, scheduleRefresh)
      .subscribe();
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(ch);
    };
  }, [user, fetchRequests]);

  return { requests, isLoading, refetch: fetchRequests };
}
