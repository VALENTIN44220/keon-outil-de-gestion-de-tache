/**
 * useITPendingValidations — demandes IT en attente de validation par le user
 * courant, sur les 2 niveaux de la chaîne de validation IT.
 *
 * Logique IT (V1) :
 *  - `it_request_status='a_relire'`  = en attente N1 (équipe IT, peer review).
 *    Le user courant peut valider s'il est dans IT_TEAM_PROFILE_IDS ET qu'il
 *    n'est PAS l'assignee (pas d'auto-validation).
 *  - `it_request_status='a_valider'` = en attente N2 (demandeur).
 *    Le user courant peut valider s'il est le requester_id.
 *
 * V2 : remplacer la résolution statique par une lecture de
 * sub_process_templates.validation_level_X_type pour permettre des variantes
 * par prestation (manager / fixed_user / requester / team).
 */
import { useEffect, useState, useCallback, useId } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { IT_TEAM_PROFILE_IDS } from './useITRequestStatus';

export interface ITPendingValidationTask {
  id: string;
  title: string;
  it_request_status: string | null;
  it_urgency: string | null;
  due_date: string | null;
  assignee_id: string | null;
  requester_id: string | null;
  source_process_template_id: string | null;
  created_at: string;
  prestation_name?: string | null; // résolu via process_templates
  assignee?: {
    id: string;
    display_name: string;
  } | null;
  requester?: {
    id: string;
    display_name: string;
  } | null;
  // ── Champs dérivés ──
  validation_level: 1 | 2;
  /** N2 toujours configuré côté IT (demandeur). Conservé pour parallélisme avec BE. */
  has_n2: boolean;
  /** Valideur N2 résolu (= requester_id). */
  n2_validator_id: string | null;
}

const sb = supabase as any;

export function useITPendingValidations() {
  const { profile: authProfile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const profile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;

  const [tasks, setTasks] = useState<ITPendingValidationTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const instanceId = useId();

  const fetchPending = useCallback(async () => {
    if (!profile?.id) {
      setTasks([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await sb
        .from('tasks')
        .select(`
          id, title, it_request_status, it_urgency, due_date,
          assignee_id, requester_id, source_process_template_id, created_at,
          prestation:process_templates!tasks_source_process_template_id_fkey(name),
          assignee:profiles!tasks_assignee_id_fkey(id, display_name),
          requester:profiles!tasks_requester_id_fkey(id, display_name)
        `)
        .eq('module_code', 'it')
        .eq('type', 'request')
        .in('it_request_status', ['a_relire', 'a_valider'])
        .order('it_urgency', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[useITPendingValidations] error', error);
        setTasks([]);
        return;
      }

      const userIsInITTeam = IT_TEAM_PROFILE_IDS.includes(profile.id);

      const result: ITPendingValidationTask[] = [];
      for (const row of (data ?? [])) {
        const requesterId = row.requester_id ?? null;
        const assigneeId = row.assignee_id ?? null;

        let level: 1 | 2;
        let canValidate = false;
        if (row.it_request_status === 'a_relire') {
          level = 1;
          // N1 = équipe IT, peer review (pas l'assignee lui-même).
          canValidate = userIsInITTeam && profile.id !== assigneeId;
        } else {
          level = 2;
          // N2 = demandeur.
          canValidate = profile.id === requesterId;
        }

        if (!canValidate) continue;

        result.push({
          id: row.id,
          title: row.title,
          it_request_status: row.it_request_status,
          it_urgency: row.it_urgency,
          due_date: row.due_date,
          assignee_id: assigneeId,
          requester_id: requesterId,
          source_process_template_id: row.source_process_template_id,
          created_at: row.created_at,
          prestation_name: row.prestation?.name ?? null,
          assignee: row.assignee ?? null,
          requester: row.requester ?? null,
          validation_level: level,
          has_n2: true,
          n2_validator_id: requesterId,
        });
      }
      setTasks(result);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void fetchPending();
  }, [fetchPending]);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`it-pending-validations:${profile.id}:${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tasks', filter: 'module_code=eq.it' },
        () => { void fetchPending(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [profile?.id, fetchPending, instanceId]);

  return {
    tasks,
    count: tasks.length,
    isLoading,
    refetch: fetchPending,
  };
}
