/**
 * useITRequestStatus — Gestion du it_request_status des demandes IT.
 *
 * Cloné du flux BE (useBETaskStatus) — même architecture, valeurs distinctes
 * pour isoler les deux flux.
 *
 * Workflow :
 *   affectee ──[Commencer]──▶ en_cours ──[Soumettre]──▶ a_relire (N1 équipe IT)
 *                                                     ──▶ a_valider (N2 demandeur)
 *                                                     ──▶ cloturee
 *                                ↓
 *                                ├──▶ en_attente_externe / ticket_itp / ticket_blc / chiffrage ──▶ en_cours
 *                                └──▶ complement_demande ──▶ en_cours
 *                                                     ──▶ refusee (terminal négatif)
 */

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ITRequestStatus =
  | 'affectee'
  | 'en_cours'
  | 'a_relire'
  | 'a_valider'
  | 'cloturee'
  | 'refusee'
  | 'complement_demande'
  | 'en_attente_externe'
  | 'en_attente_ticket_itp'
  | 'en_attente_ticket_blc'
  | 'en_attente_chiffrage';

export interface ITRequestStatusMeta {
  value: ITRequestStatus;
  label: string;
  color: string;
  textColor: string;
  bgClass: string;
  textClass: string;
  nextStatuses: ITRequestStatus[];
  icon: string;
}

// ─── Métadonnées statiques ───────────────────────────────────────────────────

export const IT_REQUEST_STATUS_META: Record<ITRequestStatus, ITRequestStatusMeta> = {
  affectee: {
    value: 'affectee',
    label: 'Affectée',
    color: '#6366f1',
    textColor: '#4338ca',
    bgClass: 'bg-indigo-100 dark:bg-indigo-900/30',
    textClass: 'text-indigo-700 dark:text-indigo-400',
    nextStatuses: ['en_cours'],
    icon: '👤',
  },
  en_cours: {
    value: 'en_cours',
    label: 'En cours',
    color: '#3b82f6',
    textColor: '#1d4ed8',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
    textClass: 'text-blue-700 dark:text-blue-400',
    nextStatuses: [
      'a_relire',
      'complement_demande',
      'en_attente_externe',
      'en_attente_ticket_itp',
      'en_attente_ticket_blc',
      'en_attente_chiffrage',
    ],
    icon: '⚙️',
  },
  a_relire: {
    value: 'a_relire',
    label: 'À relire (équipe IT)',
    color: '#a855f7',
    textColor: '#7e22ce',
    bgClass: 'bg-purple-100 dark:bg-purple-900/30',
    textClass: 'text-purple-700 dark:text-purple-400',
    // Issues N1 : valider → a_valider (N2 demandeur) ; complément → en_cours ; refus → refusee
    nextStatuses: ['a_valider', 'en_cours', 'refusee'],
    icon: '👁️',
  },
  a_valider: {
    value: 'a_valider',
    label: 'À valider (demandeur)',
    color: '#f59e0b',
    textColor: '#b45309',
    bgClass: 'bg-amber-100 dark:bg-amber-900/30',
    textClass: 'text-amber-700 dark:text-amber-400',
    // Issues N2 : valider → cloturee ; complément → en_cours ; refus → refusee
    nextStatuses: ['cloturee', 'en_cours', 'refusee'],
    icon: '✅',
  },
  cloturee: {
    value: 'cloturee',
    label: 'Clôturée',
    color: '#22c55e',
    textColor: '#15803d',
    bgClass: 'bg-emerald-100 dark:bg-emerald-900/30',
    textClass: 'text-emerald-700 dark:text-emerald-400',
    nextStatuses: [],
    icon: '🎉',
  },
  refusee: {
    value: 'refusee',
    label: 'Refusée',
    color: '#dc2626',
    textColor: '#991b1b',
    bgClass: 'bg-rose-100 dark:bg-rose-900/30',
    textClass: 'text-rose-700 dark:text-rose-400',
    nextStatuses: ['en_cours'], // récupération admin possible
    icon: '⛔',
  },
  complement_demande: {
    value: 'complement_demande',
    label: 'Complément demandé',
    color: '#ef4444',
    textColor: '#b91c1c',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
    textClass: 'text-red-700 dark:text-red-400',
    nextStatuses: ['en_cours'],
    icon: '📋',
  },
  en_attente_externe: {
    value: 'en_attente_externe',
    label: 'Attente tiers',
    color: '#64748b',
    textColor: '#334155',
    bgClass: 'bg-slate-100 dark:bg-slate-800',
    textClass: 'text-slate-700 dark:text-slate-300',
    nextStatuses: ['en_cours'],
    icon: '⏳',
  },
  en_attente_ticket_itp: {
    value: 'en_attente_ticket_itp',
    label: 'Attente ticket ITP (Divalto)',
    color: '#0891b2',
    textColor: '#0e7490',
    bgClass: 'bg-cyan-100 dark:bg-cyan-900/30',
    textClass: 'text-cyan-700 dark:text-cyan-400',
    nextStatuses: ['en_cours'],
    icon: '🎫',
  },
  en_attente_ticket_blc: {
    value: 'en_attente_ticket_blc',
    label: 'Attente ticket BLC (Pipedrive)',
    color: '#0d9488',
    textColor: '#0f766e',
    bgClass: 'bg-teal-100 dark:bg-teal-900/30',
    textClass: 'text-teal-700 dark:text-teal-400',
    nextStatuses: ['en_cours'],
    icon: '🎫',
  },
  en_attente_chiffrage: {
    value: 'en_attente_chiffrage',
    label: 'Attente chiffrage',
    color: '#ea580c',
    textColor: '#c2410c',
    bgClass: 'bg-orange-100 dark:bg-orange-900/30',
    textClass: 'text-orange-700 dark:text-orange-400',
    nextStatuses: ['en_cours'],
    icon: '💰',
  },
};

export const IT_REQUEST_STATUS_LIST: ITRequestStatusMeta[] = [
  IT_REQUEST_STATUS_META.affectee,
  IT_REQUEST_STATUS_META.en_cours,
  IT_REQUEST_STATUS_META.a_relire,
  IT_REQUEST_STATUS_META.a_valider,
  IT_REQUEST_STATUS_META.cloturee,
  IT_REQUEST_STATUS_META.refusee,
  IT_REQUEST_STATUS_META.complement_demande,
  IT_REQUEST_STATUS_META.en_attente_externe,
  IT_REQUEST_STATUS_META.en_attente_ticket_itp,
  IT_REQUEST_STATUS_META.en_attente_ticket_blc,
  IT_REQUEST_STATUS_META.en_attente_chiffrage,
];

/**
 * IT_TEAM_PROFILE_IDS — Membres de l'équipe IT (peer review N1).
 * V1 : liste hardcodée. V2 : à remonter depuis une table de configuration
 * (process_templates.settings.team_member_profile_ids ou table dédiée).
 *
 * N'importe quel membre listé ici peut valider N1 d'une demande IT, SAUF
 * l'assignee lui-même (pas d'auto-validation).
 */
export const IT_TEAM_PROFILE_IDS: readonly string[] = [
  '49d0e4b8-4c32-405f-8c9c-0c5a1fac334e', // PERSAD SALAS Ranjit
  '9144d1ff-71dd-4273-8b58-54927ad87773', // MOLTO Hugues
  '81750c79-efb6-48e2-8788-0ec9a6f13b68', // BERTRAND Valentin
  '82a41298-92ee-4642-b9d3-f82080c26907', // HILY HOULES Robin
  '791009d8-65f2-40ac-be5f-d0c468df1480', // KABORE Audrey (Support Lucca)
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getITRequestStatusMeta(status: string | null | undefined): ITRequestStatusMeta {
  if (!status) return IT_REQUEST_STATUS_META.affectee;
  return IT_REQUEST_STATUS_META[status as ITRequestStatus] ?? IT_REQUEST_STATUS_META.affectee;
}

// ─── Hook principal ───────────────────────────────────────────────────────────

const sb = supabase as any;

export interface ITStatusNotifyContext {
  taskLabel: string;
  prestationName?: string;
  /** dispatch_manager_id du sub_process_template — utilisé pour →a_relire si pas de notifyOverride */
  dispatchManagerId?: string | null;
  assigneeId?: string | null;
  requesterId?: string | null;
}

export interface ITStatusNotifyOverride {
  recipients: Array<{
    profileId: string | null | undefined;
    title: string;
    message: string;
    type: string;
  }>;
}

/**
 * Hook : update it_request_status avec merge de it_status_dates et notifications.
 *
 * @example
 * const { updateITRequestStatus, submitValidationOutcome } = useITRequestStatus();
 * await updateITRequestStatus({ taskId, status: 'a_relire', notify: { ... } });
 */
export function useITRequestStatus() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const mutation = useMutation({
    mutationFn: async ({
      taskId,
      status,
      notify,
      notifyOverride,
      extraUpdates,
    }: {
      taskId: string;
      status: ITRequestStatus;
      notify?: ITStatusNotifyContext;
      notifyOverride?: ITStatusNotifyOverride;
      extraUpdates?: Record<string, unknown>;
    }) => {
      const { data: existing } = await sb
        .from('tasks')
        .select('it_status_dates')
        .eq('id', taskId)
        .single();
      const currentDates = (existing?.it_status_dates as Record<string, string> | null) ?? {};
      const updatedDates = { ...currentDates, [status]: new Date().toISOString() };

      const { data, error } = await sb
        .from('tasks')
        .update({
          it_request_status: status,
          it_status_dates: updatedDates,
          ...(extraUpdates ?? {}),
        })
        .eq('id', taskId)
        .select('id, it_request_status, it_status_dates, it_project_id')
        .single();
      if (error) throw error;

      // ── Notifications : profile.id → auth.user_id ────────────────────────────
      if (notifyOverride) {
        for (const rec of notifyOverride.recipients) {
          if (!rec.profileId) continue;
          const { data: prf } = await sb
            .from('profiles').select('user_id').eq('id', rec.profileId).maybeSingle();
          const recipientUserId = prf?.user_id ?? null;
          if (recipientUserId && recipientUserId !== user?.id) {
            await sb.from('notifications').insert({
              user_id: recipientUserId,
              title: rec.title,
              message: rec.message,
              type: rec.type,
              related_entity_type: 'task',
              related_entity_id: taskId,
            });
          }
        }
      } else if (notify) {
        const suffix = notify.prestationName ? ` — ${notify.prestationName}` : '';
        let recipientProfileId: string | null = null;
        let notifTitle = '';
        let notifMsg = '';
        let notifType = '';
        if (status === 'a_relire') {
          // N1 = équipe IT. Sans cible explicite, on notifie le dispatch_manager
          // (qui est aussi l'assignee par défaut côté IT). En pratique, la N1
          // équipe est résolue par useITPendingValidations côté chaque user.
          recipientProfileId = notify.dispatchManagerId ?? null;
          notifTitle = `À relire (équipe IT) : ${notify.taskLabel}`;
          notifMsg = `Une demande IT attend une relecture${suffix}.`;
          notifType = 'it_a_relire';
        } else if (status === 'a_valider' && notify.requesterId) {
          recipientProfileId = notify.requesterId;
          notifTitle = `À valider : ${notify.taskLabel}`;
          notifMsg = `Votre demande IT attend votre validation${suffix}.`;
          notifType = 'it_a_valider';
        } else if (status === 'cloturee' && notify.requesterId) {
          recipientProfileId = notify.requesterId;
          notifTitle = `Clôturée : ${notify.taskLabel}`;
          notifMsg = `Votre demande IT a été clôturée${suffix}.`;
          notifType = 'it_cloturee';
        }

        if (recipientProfileId) {
          const { data: prf } = await sb
            .from('profiles').select('user_id').eq('id', recipientProfileId).maybeSingle();
          const recipientUserId = prf?.user_id ?? null;
          if (recipientUserId && recipientUserId !== user?.id) {
            await sb.from('notifications').insert({
              user_id: recipientUserId,
              title: notifTitle,
              message: notifMsg,
              type: notifType,
              related_entity_type: 'task',
              related_entity_id: taskId,
            });
          }
        }
      }

      return data;
    },
    onSuccess: (data) => {
      const meta = getITRequestStatusMeta(data.it_request_status);
      toast.success(`Statut mis à jour : ${meta.label}`);
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['it-requests'] });
      qc.invalidateQueries({ queryKey: ['it-dispatch-tasks'] });
      if (data.it_project_id) {
        qc.invalidateQueries({ queryKey: ['it-tasks', data.it_project_id] });
      }
    },
    onError: (err: any) => {
      console.error('[useITRequestStatus] update error:', err);
      toast.error(err.message || 'Erreur lors de la mise à jour du statut');
    },
  });

  const updateITRequestStatus = useCallback(
    (params: {
      taskId: string;
      status: ITRequestStatus;
      notify?: ITStatusNotifyContext;
      notifyOverride?: ITStatusNotifyOverride;
      extraUpdates?: Record<string, unknown>;
    }) => mutation.mutateAsync(params),
    [mutation],
  );

  /**
   * Validation à 3 issues sur a_relire (N1 équipe IT) OU a_valider (N2 demandeur) :
   *   - 'validate'  → a_valider (depuis a_relire) ou cloturee (depuis a_valider)
   *   - 'complement'→ en_cours (renvoi à l'exécutant, commentaire obligatoire)
   *   - 'refuse'    → refusee  (terminal, commentaire obligatoire)
   */
  const submitValidationOutcome = useCallback(
    async (params: {
      taskId: string;
      currentStatus: ITRequestStatus; // a_relire ou a_valider
      outcome: 'validate' | 'complement' | 'refuse';
      comment?: string;
      taskLabel: string;
      prestationName?: string;
      assigneeId?: string | null;
      requesterId?: string | null;
    }): Promise<void> => {
      const { taskId, currentStatus, outcome, comment, taskLabel, prestationName, assigneeId, requesterId } = params;
      const suffix = prestationName ? ` — ${prestationName}` : '';
      const needsComment = outcome !== 'validate';
      const trimmed = (comment ?? '').trim();
      if (needsComment && !trimmed) {
        toast.error('Un commentaire est requis pour cette action');
        throw new Error('comment required');
      }

      // Nouveau statut selon currentStatus + outcome
      let newStatus: ITRequestStatus;
      if (outcome === 'validate') {
        newStatus = currentStatus === 'a_relire' ? 'a_valider' : 'cloturee';
      } else if (outcome === 'complement') {
        newStatus = 'en_cours';
      } else {
        newStatus = 'refusee';
      }

      const { data: existing } = await sb
        .from('tasks').select('it_status_dates').eq('id', taskId).single();
      const currentDates = (existing?.it_status_dates as Record<string, string> | null) ?? {};
      const updatedDates = { ...currentDates, [newStatus]: new Date().toISOString() };
      const updatePayload: any = { it_request_status: newStatus, it_status_dates: updatedDates };
      if (outcome === 'refuse') updatePayload.status = 'cancelled';
      const { error: upErr } = await sb.from('tasks').update(updatePayload).eq('id', taskId);
      if (upErr) {
        toast.error(upErr.message || 'Erreur de mise à jour');
        throw upErr;
      }

      // Commentaire (complément / refus)
      if (needsComment && trimmed) {
        const { data: me } = await sb
          .from('profiles').select('id').eq('user_id', user?.id ?? '').maybeSingle();
        if (me?.id) {
          const prefix = outcome === 'refuse' ? '⛔ Refus' : '↩️ Demande de complément';
          await sb.from('task_comments').insert({
            task_id: taskId,
            author_id: me.id,
            content: `${prefix} (${taskLabel}) — ${trimmed}`,
          });
        }
      }

      // Notifications
      type Notif = { user_id: string; title: string; message: string; type: string; related_entity_type: string; related_entity_id: string };
      const recipients: Array<{ profileId: string; type: string; title: string; message: string }> = [];

      if (outcome === 'validate') {
        if (newStatus === 'a_valider' && requesterId) {
          recipients.push({
            profileId: requesterId, type: 'it_a_valider',
            title: `À valider : ${taskLabel}`,
            message: `Votre demande IT attend votre validation${suffix}.`,
          });
        } else if (newStatus === 'cloturee' && requesterId) {
          recipients.push({
            profileId: requesterId, type: 'it_cloturee',
            title: `Clôturée : ${taskLabel}`,
            message: `Votre demande IT a été clôturée${suffix}.`,
          });
        }
      } else if (outcome === 'complement' && assigneeId) {
        recipients.push({
          profileId: assigneeId, type: 'it_complement_demande',
          title: `Complément demandé : ${taskLabel}`,
          message: `Un complément vous est demandé${suffix} : ${trimmed.slice(0, 120)}`,
        });
      } else if (outcome === 'refuse') {
        if (assigneeId) recipients.push({
          profileId: assigneeId, type: 'it_refusee',
          title: `Refusée : ${taskLabel}`,
          message: `Cette demande IT a été refusée${suffix} : ${trimmed.slice(0, 120)}`,
        });
        if (requesterId && requesterId !== assigneeId) recipients.push({
          profileId: requesterId, type: 'it_refusee',
          title: `Refusée : ${taskLabel}`,
          message: `Cette demande IT a été refusée${suffix} : ${trimmed.slice(0, 120)}`,
        });
      }

      if (recipients.length > 0) {
        const profileIds = recipients.map(r => r.profileId);
        const { data: prfs } = await sb
          .from('profiles').select('id, user_id').in('id', profileIds);
        const authByProfile = new Map<string, string>();
        (prfs ?? []).forEach((p: any) => { if (p.user_id) authByProfile.set(p.id, p.user_id); });
        const notifs: Notif[] = [];
        for (const r of recipients) {
          const uid = authByProfile.get(r.profileId);
          if (uid && uid !== user?.id) {
            notifs.push({
              user_id: uid,
              title: r.title, message: r.message, type: r.type,
              related_entity_type: 'task', related_entity_id: taskId,
            });
          }
        }
        if (notifs.length > 0) await sb.from('notifications').insert(notifs);
      }

      const label =
        outcome === 'validate' ? (newStatus === 'cloturee' ? 'Clôturée' : 'Validée (N1)') :
        outcome === 'complement' ? 'Complément demandé' :
        'Refusée';
      toast.success(label);
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['it-requests'] });
      qc.invalidateQueries({ queryKey: ['it-dispatch-tasks'] });
    },
    [qc, user],
  );

  return {
    updateITRequestStatus,
    submitValidationOutcome,
    isUpdating: mutation.isPending,
  };
}
