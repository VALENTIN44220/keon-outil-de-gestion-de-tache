/**
 * useBEPendingValidations — tâches BE en attente de validation par le user
 * courant (en tant que dispatch_manager du sous-processus).
 *
 * Logique BE :
 *  - Une tâche BE soumise par l'exécutant atteint `be_status='a_relire'`.
 *  - Le `dispatch_manager_id` du `sub_process_template` est le validateur.
 *  - Il doit pouvoir cliquer « Valider » pour passer à `be_status='a_valider'`,
 *    ou renvoyer la tâche au statut précédent (`en_cours`).
 *
 * Ce hook agrège les tâches dans cet état pour le user courant et est
 * consommé dans le tab « Validations » du dashboard pour centraliser la
 * vision des choses à valider (legacy + BE).
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';

export interface BEPendingValidationTask {
  id: string;
  title: string;
  be_status: string | null;
  be_urgency: string | null;
  due_date: string | null;
  duration_hours: number | null;
  parent_request_id: string | null;
  assignee_id: string | null;
  created_at: string;
  sub_process_template?: {
    id: string;
    name: string;
    dispatch_manager_id: string | null;
  } | null;
  be_project?: {
    code_projet: string;
    nom_projet: string;
  } | null;
  assignee?: {
    id: string;
    display_name: string;
  } | null;
}

const sb = supabase as any;

export function useBEPendingValidations() {
  const { profile: authProfile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const profile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;

  const [tasks, setTasks] = useState<BEPendingValidationTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPending = useCallback(async () => {
    if (!profile?.id) {
      setTasks([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Tâches BE à relire dont le user est le dispatch_manager
      const { data, error } = await sb
        .from('tasks')
        .select(`
          id, title, be_status, be_urgency, due_date, duration_hours,
          parent_request_id, assignee_id, created_at,
          sub_process_template:sub_process_templates!tasks_sub_process_template_id_fkey(
            id, name, dispatch_manager_id
          ),
          be_project:be_projects!tasks_be_project_id_fkey(code_projet, nom_projet),
          assignee:profiles!tasks_assignee_id_fkey(id, display_name)
        `)
        .eq('type', 'task')
        .eq('be_status', 'a_relire')
        .order('be_urgency', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[useBEPendingValidations] error', error);
        setTasks([]);
        return;
      }

      // Filtre côté client par dispatch_manager_id (PostgREST n'accepte pas
      // de filtre sur une jointure imbriquée directement).
      const filtered = ((data ?? []) as BEPendingValidationTask[]).filter(
        (t) => t.sub_process_template?.dispatch_manager_id === profile.id,
      );
      setTasks(filtered);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void fetchPending();
  }, [fetchPending]);

  // Realtime : refresh quand un be_status change sur une tâche
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`be-pending-validations:${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tasks', filter: 'type=eq.task' },
        () => { void fetchPending(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [profile?.id, fetchPending]);

  return {
    tasks,
    count: tasks.length,
    isLoading,
    refetch: fetchPending,
  };
}
