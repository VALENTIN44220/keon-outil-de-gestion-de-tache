import { useEffect, useId } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import type { BugReport, BugStatus, BugPriority, BugType } from '@/types/bugReport';

// La table bug_reports n'est pas dans les types générés : on caste l'accès client.
// Le typage métier est assuré par les interfaces de @/types/bugReport.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

const SELECT =
  '*, reporter:profiles!bug_reports_reported_by_fkey(id,display_name,avatar_url), assignee:profiles!bug_reports_assigned_to_fkey(id,display_name,avatar_url)';

const KEY = ['bug-reports'];

/** Profil courant (respecte la simulation QA, comme le reste de l'app). */
export function useCurrentProfileId(): string | null {
  const { profile: authProfile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const profile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;
  return profile?.id ?? null;
}

/** Liste des tickets (non supprimés) + abonnement realtime. */
export function useBugReports() {
  const qc = useQueryClient();
  const instanceId = useId();

  const query = useQuery<BugReport[]>({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await db()
        .from('bug_reports')
        .select(SELECT)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as BugReport[];
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`bug_reports:${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bug_reports' }, () => {
        qc.invalidateQueries({ queryKey: KEY });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [qc, instanceId]);

  return query;
}

export interface CreateBugReportInput {
  title: string;
  description?: string | null;
  type: BugType;
  priority: BugPriority;
  page_url?: string | null;
  user_agent?: string | null;
}

/** Création d'un ticket par l'utilisateur courant. */
export function useCreateBugReport() {
  const qc = useQueryClient();
  const reporterId = useCurrentProfileId();
  return useMutation({
    mutationFn: async (input: CreateBugReportInput): Promise<BugReport> => {
      const { data, error } = await db()
        .from('bug_reports')
        .insert({
          title: input.title.trim(),
          description: input.description?.trim() || null,
          type: input.type,
          priority: input.priority,
          page_url: input.page_url ?? null,
          user_agent: input.user_agent ?? null,
          reported_by: reporterId,
        })
        .select(SELECT)
        .single();
      if (error) throw error;
      return data as BugReport;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export interface UpdateBugReportInput {
  id: string;
  status?: BugStatus;
  priority?: BugPriority;
  assigned_to?: string | null;
  /** Statut courant, requis pour tracer l'historique quand le statut change. */
  currentStatus?: BugStatus;
}

/** Mise à jour (triage admin). Trace l'historique si le statut change. */
export function useUpdateBugReport() {
  const qc = useQueryClient();
  const changedBy = useCurrentProfileId();
  return useMutation({
    mutationFn: async ({ id, status, priority, assigned_to, currentStatus }: UpdateBugReportInput) => {
      const patch: Record<string, unknown> = {};
      if (status !== undefined) {
        patch.status = status;
        patch.resolved_at = status === 'resolu' ? new Date().toISOString() : null;
      }
      if (priority !== undefined) patch.priority = priority;
      if (assigned_to !== undefined) patch.assigned_to = assigned_to;

      const { error } = await db().from('bug_reports').update(patch).eq('id', id);
      if (error) throw error;

      // Historique de statut (côté client : changed_by = profil courant)
      if (status !== undefined && status !== currentStatus) {
        await db().from('bug_report_status_history').insert({
          bug_report_id: id,
          from_status: currentStatus ?? null,
          to_status: status,
          changed_by: changedBy,
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Suppression douce (soft delete) — réservée aux admins (gardé côté UI). */
export function useDeleteBugReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db()
        .from('bug_reports')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Historique de statut d'un ticket. */
export function useBugReportStatusHistory(bugReportId: string | null) {
  return useQuery({
    queryKey: ['bug-report-history', bugReportId],
    enabled: !!bugReportId,
    queryFn: async () => {
      const { data, error } = await db()
        .from('bug_report_status_history')
        .select('*, changer:profiles!bug_report_status_history_changed_by_fkey(id,display_name,avatar_url)')
        .eq('bug_report_id', bugReportId!)
        .order('changed_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 15_000,
  });
}
