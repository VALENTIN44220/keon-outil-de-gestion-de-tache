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

/** Mise à jour (triage admin ou assigné). Trace l'historique si le statut change.
 *  Envoie une notification à l'assigné (lors de l'assignation) et au rapporteur (changement de statut). */
export function useUpdateBugReport() {
  const qc = useQueryClient();
  const changedBy = useCurrentProfileId();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, status, priority, assigned_to, currentStatus }: UpdateBugReportInput) => {
      // Charger l'état actuel pour les notifications
      const { data: current } = await db()
        .from('bug_reports')
        .select('ref, title, assigned_to, reported_by')
        .eq('id', id)
        .single();

      const patch: Record<string, unknown> = {};
      if (status !== undefined) {
        patch.status = status;
        patch.resolved_at = status === 'resolu' ? new Date().toISOString() : null;
      }
      if (priority !== undefined) patch.priority = priority;
      if (assigned_to !== undefined) patch.assigned_to = assigned_to;

      const { error } = await db().from('bug_reports').update(patch).eq('id', id);
      if (error) throw error;

      // Historique de statut
      if (status !== undefined && status !== currentStatus) {
        await db().from('bug_report_status_history').insert({
          bug_report_id: id,
          from_status: currentStatus ?? null,
          to_status: status,
          changed_by: changedBy,
        });
      }

      const bugRef = current?.ref ?? '';
      const bugTitle = current?.title ?? '';

      // Notifier l'assigné quand il est nouvellement affecté
      if (assigned_to && assigned_to !== current?.assigned_to) {
        const assigneeUserId = await profileToUserId(assigned_to);
        if (assigneeUserId && assigneeUserId !== user?.id) {
          await db().from('notifications').insert({
            user_id: assigneeUserId,
            title: 'Bug assigné',
            message: `Le ticket ${bugRef} « ${bugTitle} » vous a été assigné.`,
            type: 'bug_assigned',
            related_entity_type: 'bug_report',
            related_entity_id: id,
          });
        }
      }

      // Notifier le rapporteur quand le statut change (sauf si c'est lui qui change)
      if (status !== undefined && status !== currentStatus && current?.reported_by) {
        const reporterUserId = await profileToUserId(current.reported_by);
        if (reporterUserId && reporterUserId !== user?.id) {
          const statusLabel = status.replace('_', ' ');
          await db().from('notifications').insert({
            user_id: reporterUserId,
            title: 'Mise à jour de votre signalement',
            message: `Le ticket ${bugRef} « ${bugTitle} » est passé en « ${statusLabel} ».`,
            type: 'bug_status_change',
            related_entity_type: 'bug_report',
            related_entity_id: id,
          });
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

async function profileToUserId(profileId: string): Promise<string | null> {
  const { data } = await db()
    .from('profiles')
    .select('user_id')
    .eq('id', profileId)
    .maybeSingle();
  return data?.user_id ?? null;
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
