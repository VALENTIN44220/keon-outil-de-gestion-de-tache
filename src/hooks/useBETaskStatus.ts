/**
 * useBETaskStatus — Gestion du be_status des tâches Bureau d'Études.
 *
 * Fournit :
 * - Les métadonnées de chaque statut BE (label, couleurs, icône, transitions autorisées)
 * - Un hook pour mettre à jour le be_status d'une tâche
 *
 * Workflow complet :
 *   soumise ──[assignation auto]──▶ affectee ──[Commencer]──▶ en_cours
 *   ──[Soumettre]──▶ a_relire ──[Valider]──▶ a_valider
 *   ──▶ a_deposer ──▶ en_instruction ──▶ [complement_demande | cloturee]
 */

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

export type BETaskStatus =
  | 'soumise'
  | 'affectee'
  | 'en_cours'
  | 'a_relire'
  | 'a_valider'
  | 'a_deposer'
  | 'en_instruction'
  | 'complement_demande'
  | 'cloturee'
  | 'refusee';

export interface BEStatusMeta {
  value: BETaskStatus;
  label: string;
  /** Couleur hex pour fond et bordure */
  color: string;
  /** Couleur hex du texte */
  textColor: string;
  /** Classe Tailwind pour le fond léger */
  bgClass: string;
  /** Classe Tailwind pour le texte */
  textClass: string;
  /** Transitions manuelles autorisées depuis ce statut (dropdown BEStatusBadge) */
  nextStatuses: BETaskStatus[];
  /** Emoji ou symbole court pour usage compact */
  icon: string;
}

// ─── Métadonnées statiques ───────────────────────────────────────────────────

export const BE_STATUS_META: Record<BETaskStatus, BEStatusMeta> = {
  soumise: {
    value: 'soumise',
    label: 'Soumise',
    color: '#94a3b8',
    textColor: '#475569',
    bgClass: 'bg-slate-100 dark:bg-slate-800',
    textClass: 'text-slate-600 dark:text-slate-400',
    // Pas de transition manuelle — l'assignation déclenche automatiquement 'affectee'
    nextStatuses: [],
    icon: '📥',
  },
  affectee: {
    value: 'affectee',
    label: 'Affectée',
    color: '#6366f1',
    textColor: '#4338ca',
    bgClass: 'bg-indigo-100 dark:bg-indigo-900/30',
    textClass: 'text-indigo-700 dark:text-indigo-400',
    // Transition manuelle → en_cours (bouton Commencer dans le dispatch)
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
    nextStatuses: ['a_relire', 'a_valider', 'a_deposer'],
    icon: '⚙️',
  },
  a_relire: {
    value: 'a_relire',
    label: 'À relire',
    color: '#a855f7',
    textColor: '#7e22ce',
    bgClass: 'bg-purple-100 dark:bg-purple-900/30',
    textClass: 'text-purple-700 dark:text-purple-400',
    nextStatuses: ['en_cours', 'a_valider'],
    icon: '👁️',
  },
  a_valider: {
    value: 'a_valider',
    label: 'À valider',
    color: '#f59e0b',
    textColor: '#b45309',
    bgClass: 'bg-amber-100 dark:bg-amber-900/30',
    textClass: 'text-amber-700 dark:text-amber-400',
    nextStatuses: ['en_cours', 'a_deposer', 'a_relire'],
    icon: '✅',
  },
  a_deposer: {
    value: 'a_deposer',
    label: 'À déposer',
    color: '#06b6d4',
    textColor: '#0e7490',
    bgClass: 'bg-cyan-100 dark:bg-cyan-900/30',
    textClass: 'text-cyan-700 dark:text-cyan-400',
    nextStatuses: ['en_instruction', 'en_cours'],
    icon: '📤',
  },
  en_instruction: {
    value: 'en_instruction',
    label: 'En instruction',
    color: '#f97316',
    textColor: '#c2410c',
    bgClass: 'bg-orange-100 dark:bg-orange-900/30',
    textClass: 'text-orange-700 dark:text-orange-400',
    nextStatuses: ['complement_demande', 'cloturee'],
    icon: '🏛️',
  },
  complement_demande: {
    value: 'complement_demande',
    label: 'Complément demandé',
    color: '#ef4444',
    textColor: '#b91c1c',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
    textClass: 'text-red-700 dark:text-red-400',
    nextStatuses: ['en_cours', 'en_instruction'],
    icon: '📋',
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
    bgClass: 'bg-red-100 dark:bg-red-900/30',
    textClass: 'text-red-700 dark:text-red-400',
    nextStatuses: [],
    icon: '⛔',
  },
};

/** Liste ordonnée pour affichage */
export const BE_STATUS_LIST: BEStatusMeta[] = [
  BE_STATUS_META.soumise,
  BE_STATUS_META.affectee,
  BE_STATUS_META.en_cours,
  BE_STATUS_META.a_relire,
  BE_STATUS_META.a_valider,
  BE_STATUS_META.a_deposer,
  BE_STATUS_META.en_instruction,
  BE_STATUS_META.complement_demande,
  BE_STATUS_META.cloturee,
  BE_STATUS_META.refusee,
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Retourne les métadonnées d'un statut (fallback sur soumise si inconnu). */
export function getBEStatusMeta(status: string | null | undefined): BEStatusMeta {
  if (!status) return BE_STATUS_META.soumise;
  return BE_STATUS_META[status as BETaskStatus] ?? BE_STATUS_META.soumise;
}

// ─── Hook principal ───────────────────────────────────────────────────────────

const sb = supabase as any;

/**
 * Contexte optionnel pour déclencher une notification in-app après changement de statut.
 *
 * Notifications émises selon la transition :
 *   → a_relire          : notifie le manager (dispatch_manager_id)
 *   → a_valider         : notifie le worker (assignee_id)
 *   → cloturee          : notifie le demandeur (requester_id)
 */
export interface BEStatusNotifyContext {
  /** Nom court de la prestation (affiché dans la notification) */
  taskLabel: string;
  /** Code du projet BE (affiché dans la notification) */
  projectCode?: string;
  /** dispatch_manager_id du sub_process_template — destinataire pour → a_relire */
  dispatchManagerId?: string | null;
  /** ID du worker actuellement assigné — destinataire pour → a_valider */
  assigneeId?: string | null;
  /** ID du demandeur — destinataire pour → cloturee */
  requesterId?: string | null;
}

/**
 * Fournit une mutation pour mettre à jour le be_status d'une tâche.
 * Envoie une notification in-app au bon destinataire selon la transition.
 *
 * @example
 * const { updateBEStatus, isUpdating } = useBETaskStatus();
 * await updateBEStatus({ taskId, status: 'a_relire', notify: { ... } });
 */
export function useBETaskStatus() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const mutation = useMutation({
    mutationFn: async ({
      taskId,
      status,
      notify,
    }: {
      taskId: string;
      status: BETaskStatus;
      notify?: BEStatusNotifyContext;
    }) => {
      // Récupère l'historique courant des transitions pour le merger avec
      // la nouvelle entrée (on ne veut pas écraser les statuts précédents).
      const { data: existing } = await sb
        .from('tasks')
        .select('be_status_dates')
        .eq('id', taskId)
        .single();
      const currentDates = (existing?.be_status_dates as Record<string, string> | null) ?? {};
      const updatedDates = { ...currentDates, [status]: new Date().toISOString() };

      const { data, error } = await sb
        .from('tasks')
        .update({
          be_status: status,
          be_status_dates: updatedDates,
        })
        .eq('id', taskId)
        .select('id, be_status, be_project_id, be_status_dates')
        .single();
      if (error) throw error;

      // ── Notification in-app ──────────────────────────────────────────────
      // IMPORTANT : notifications.user_id = auth.users.id (PAS profile.id).
      // Les destinataires (dispatchManagerId/assigneeId/requesterId) sont des
      // profile.id → on les résout en user_id auth via la table profiles, sinon
      // la notif est créée avec un mauvais user_id et n'est jamais reçue.
      if (notify) {
        const projectSuffix = notify.projectCode ? ` — ${notify.projectCode}` : '';

        // Destinataire (profile.id) + contenu selon la transition
        let recipientProfileId: string | null = null;
        let notifTitle = '';
        let notifMsg = '';
        let notifType = '';
        if (status === 'a_relire' && notify.dispatchManagerId) {
          recipientProfileId = notify.dispatchManagerId;
          notifTitle = `À relire : ${notify.taskLabel}`;
          notifMsg = `Une tâche est prête pour votre relecture${projectSuffix}.`;
          notifType = 'be_a_relire';
        } else if (status === 'a_valider' && notify.assigneeId) {
          recipientProfileId = notify.assigneeId;
          notifTitle = `Validé : ${notify.taskLabel}`;
          notifMsg = `Votre travail a été validé${projectSuffix}.`;
          notifType = 'be_a_valider';
        } else if (status === 'cloturee' && notify.requesterId) {
          recipientProfileId = notify.requesterId;
          notifTitle = `Clôturée : ${notify.taskLabel}`;
          notifMsg = `Votre prestation a été clôturée${projectSuffix}.`;
          notifType = 'be_cloturee';
        }

        if (recipientProfileId) {
          const { data: prf } = await sb
            .from('profiles')
            .select('user_id')
            .eq('id', recipientProfileId)
            .maybeSingle();
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
      const meta = getBEStatusMeta(data.be_status);
      toast.success(`Statut mis à jour : ${meta.label}`);

      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['be-project-tasks'] });
      qc.invalidateQueries({ queryKey: ['be-dispatch-tasks'] });
      if (data.be_project_id) {
        qc.invalidateQueries({ queryKey: ['be-tasks', data.be_project_id] });
      }
    },
    onError: (err: any) => {
      console.error('[useBETaskStatus] update error:', err);
      toast.error(err.message || 'Erreur lors de la mise à jour du statut');
    },
  });

  const updateBEStatus = useCallback(
    (params: { taskId: string; status: BETaskStatus; notify?: BEStatusNotifyContext }) =>
      mutation.mutateAsync(params),
    [mutation],
  );

  /**
   * Validation à 3 issues sur une étape en relecture ('a_relire') :
   *   - 'validate'  → be_status='a_valider'  (l'étape suivante peut démarrer)
   *   - 'complement'→ be_status='en_cours'   (renvoi à l'exécutant, commentaire obligatoire,
   *                                            posté sur la conversation de la demande)
   *   - 'refuse'    → be_status='refusee'    (clôture refusée terminale, commentaire obligatoire)
   * Insère le commentaire sur la conversation de la demande (parent_request_id si présent,
   * sinon la tâche elle-même) et notifie le bon destinataire (auth.users.id résolu depuis
   * profile.id).
   */
  const submitValidationOutcome = useCallback(
    async (params: {
      taskId: string;
      outcome: 'validate' | 'complement' | 'refuse';
      comment?: string;
      taskLabel: string;
      projectCode?: string;
      assigneeId?: string | null;     // profile.id de l'exécutant
      requesterId?: string | null;    // profile.id du demandeur
      parentRequestId?: string | null;
    }): Promise<void> => {
      const { taskId, outcome, comment, taskLabel, projectCode, assigneeId, requesterId, parentRequestId } = params;
      const projectSuffix = projectCode ? ` — ${projectCode}` : '';
      const needsComment = outcome !== 'validate';
      const trimmed = (comment ?? '').trim();
      if (needsComment && !trimmed) {
        toast.error('Un commentaire est requis pour cette action');
        throw new Error('comment required');
      }

      // 1) Calcul du nouveau be_status
      const newStatus: BETaskStatus =
        outcome === 'validate' ? 'a_valider' :
        outcome === 'complement' ? 'en_cours' :
        'refusee';

      // 2) Update du statut (mise à jour des dates incluses via la mutation existante)
      const { data: existing } = await sb
        .from('tasks').select('be_status_dates').eq('id', taskId).single();
      const currentDates = (existing?.be_status_dates as Record<string, string> | null) ?? {};
      const updatedDates = { ...currentDates, [newStatus]: new Date().toISOString() };
      const updatePayload: any = { be_status: newStatus, be_status_dates: updatedDates };
      // En cas de refus : marquer aussi status='cancelled' pour sortir des files actives
      if (outcome === 'refuse') updatePayload.status = 'cancelled';
      const { error: upErr } = await sb.from('tasks').update(updatePayload).eq('id', taskId);
      if (upErr) {
        toast.error(upErr.message || 'Erreur de mise à jour');
        throw upErr;
      }

      // 3) Pour complément/refus : poster le commentaire sur la conversation
      //    (parent demande si dispo, sinon la tâche)
      if (needsComment && trimmed) {
        const conversationTaskId = parentRequestId || taskId;
        // Auteur = profile id courant (via auth uid → profiles.id) ; récupéré côté DB par select
        const { data: me } = await sb
          .from('profiles')
          .select('id').eq('user_id', user?.id ?? '').maybeSingle();
        if (me?.id) {
          const prefix = outcome === 'refuse' ? '⛔ Refus' : '↩️ Demande de complément';
          await sb.from('task_comments').insert({
            task_id: conversationTaskId,
            author_id: me.id,
            content: `${prefix} (${taskLabel}) — ${trimmed}`,
          });
        }
      }

      // 4) Notifications (résolution profile.id → auth user_id)
      type Notif = { user_id: string; title: string; message: string; type: string; related_entity_type: string; related_entity_id: string };
      const recipients: Array<{ profileId: string; type: string; title: string; message: string }> = [];
      if (outcome === 'validate' && assigneeId) {
        recipients.push({
          profileId: assigneeId,
          type: 'be_a_valider',
          title: `Validé : ${taskLabel}`,
          message: `Votre travail a été validé${projectSuffix}.`,
        });
      } else if (outcome === 'complement' && assigneeId) {
        recipients.push({
          profileId: assigneeId,
          type: 'be_complement_demande',
          title: `Complément demandé : ${taskLabel}`,
          message: `Un complément vous est demandé${projectSuffix} : ${trimmed.slice(0, 120)}`,
        });
      } else if (outcome === 'refuse') {
        if (assigneeId) recipients.push({
          profileId: assigneeId, type: 'be_refusee',
          title: `Refusée : ${taskLabel}`,
          message: `Votre travail a été refusé${projectSuffix} : ${trimmed.slice(0, 120)}`,
        });
        if (requesterId && requesterId !== assigneeId) recipients.push({
          profileId: requesterId, type: 'be_refusee',
          title: `Refusée : ${taskLabel}`,
          message: `Cette étape a été refusée${projectSuffix} : ${trimmed.slice(0, 120)}`,
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

      // 5) Toast + invalidation
      const label =
        outcome === 'validate' ? 'Validée' :
        outcome === 'complement' ? 'Complément demandé' :
        'Refusée';
      toast.success(label);
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['be-dispatch-tasks'] });
      qc.invalidateQueries({ queryKey: ['be-project-tasks'] });
    },
    [qc, user],
  );

  return {
    updateBEStatus,
    submitValidationOutcome,
    isUpdating: mutation.isPending,
  };
}
