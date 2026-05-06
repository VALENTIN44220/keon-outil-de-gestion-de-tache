/**
 * useBESuiviKpi — agrégation des KPIs et de la liste de tâches BE pour la
 * page /be/suivi.
 *
 * Charge les tâches BE actives (be_status non null, type='task') avec leurs
 * jointures projet/assignee/sub_process, puis calcule des compteurs métier :
 *  - prestations actives (statut ≠ cloturee)
 *  - en retard (due_date < today)
 *  - à relire / à valider (statut ∈ a_relire, a_valider)
 *  - non assignées (assignee_id null, statut soumise)
 *  - projets actifs (distinct be_project_id avec ≥1 tâche active)
 *
 * Realtime via channel sur `tasks` UPDATE.
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

export interface BESuiviTask {
  id: string;
  title: string;
  task_number: string | null;
  request_number: string | null;
  status: string;
  be_status: string | null;
  be_urgency: 'normal' | 'urgent' | 'critique' | null;
  be_project_id: string | null;
  parent_request_id: string | null;
  assignee_id: string | null;
  sub_process_template_id: string | null;
  due_date: string | null;
  start_date: string | null;
  duration_hours: number | null;
  created_at: string;
  assignee?: { id: string; display_name: string } | null;
  sub_process_template?: {
    id: string;
    name: string;
    be_category: string | null;
    dispatch_manager_id: string | null;
  } | null;
  be_project?: {
    id: string;
    code_projet: string;
    nom_projet: string;
  } | null;
}

export interface BESuiviKpis {
  /** Prestations actives (statut ≠ cloturee). */
  active: number;
  /** En retard (due_date passée et statut actif). */
  overdue: number;
  /** À relire ou à valider. */
  toValidate: number;
  /** Non assignées (assignee_id null + statut soumise). */
  unassigned: number;
  /** Projets distincts avec ≥1 tâche active. */
  activeProjects: number;
}

const TERMINAL_BE_STATUSES = new Set(['cloturee']);
const TO_VALIDATE_STATUSES = new Set(['a_relire', 'a_valider']);

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function useBESuiviKpi() {
  const query = useQuery({
    queryKey: ['be-suivi-tasks'],
    queryFn: async (): Promise<BESuiviTask[]> => {
      const { data, error } = await sb
        .from('tasks')
        .select(`
          id, title, task_number, request_number, status, be_status, be_urgency,
          be_project_id, parent_request_id, assignee_id, sub_process_template_id,
          due_date, start_date, duration_hours, created_at,
          assignee:profiles!tasks_assignee_id_fkey(id, display_name),
          sub_process_template:sub_process_templates!tasks_sub_process_template_id_fkey(
            id, name, be_category, dispatch_manager_id
          ),
          be_project:be_projects!tasks_be_project_id_fkey(id, code_projet, nom_projet)
        `)
        .eq('type', 'task')
        .not('be_status', 'is', null)
        .order('be_urgency', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[useBESuiviKpi] error', error);
        return [];
      }
      return (data ?? []) as BESuiviTask[];
    },
    staleTime: 30_000,
  });

  // Realtime : invalide la query quand une tâche BE change
  useEffect(() => {
    const channel = supabase
      .channel('be-suivi-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: 'type=eq.task' },
        () => { void query.refetch(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tasks = query.data ?? [];
  const todayStr = ymd(new Date());

  const kpis: BESuiviKpis = (() => {
    let active = 0;
    let overdue = 0;
    let toValidate = 0;
    let unassigned = 0;
    const activeProjects = new Set<string>();

    for (const t of tasks) {
      const status = t.be_status ?? '';
      if (TERMINAL_BE_STATUSES.has(status)) continue;

      active += 1;
      if (t.be_project_id) activeProjects.add(t.be_project_id);
      if (t.due_date && t.due_date < todayStr) overdue += 1;
      if (TO_VALIDATE_STATUSES.has(status)) toValidate += 1;
      if (!t.assignee_id && status === 'soumise') unassigned += 1;
    }

    return {
      active,
      overdue,
      toValidate,
      unassigned,
      activeProjects: activeProjects.size,
    };
  })();

  return {
    tasks,
    kpis,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
