/**
 * useBETaskStatus — Gestion du be_status des tâches Bureau d'Études.
 *
 * Fournit :
 * - Les métadonnées de chaque statut BE (label, couleurs, icône, transitions autorisées)
 * - Un hook pour mettre à jour le be_status d'une tâche
 */

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

export type BETaskStatus =
  | 'en_cours'
  | 'a_relire'
  | 'a_valider'
  | 'a_deposer'
  | 'en_instruction'
  | 'complement_demande'
  | 'cloturee';

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
  /** Transitions vers lesquelles on peut aller depuis ce statut */
  nextStatuses: BETaskStatus[];
  /** Emoji ou symbole court pour usage compact */
  icon: string;
}

// ─── Métadonnées statiques ───────────────────────────────────────────────────

export const BE_STATUS_META: Record<BETaskStatus, BEStatusMeta> = {
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
};

/** Liste ordonnée pour affichage */
export const BE_STATUS_LIST: BEStatusMeta[] = [
  BE_STATUS_META.en_cours,
  BE_STATUS_META.a_relire,
  BE_STATUS_META.a_valider,
  BE_STATUS_META.a_deposer,
  BE_STATUS_META.en_instruction,
  BE_STATUS_META.complement_demande,
  BE_STATUS_META.cloturee,
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Retourne les métadonnées d'un statut (fallback sur en_cours si inconnu). */
export function getBEStatusMeta(status: string | null | undefined): BEStatusMeta {
  if (!status) return BE_STATUS_META.en_cours;
  return BE_STATUS_META[status as BETaskStatus] ?? BE_STATUS_META.en_cours;
}

// ─── Hook principal ───────────────────────────────────────────────────────────

const sb = supabase as any;

/**
 * Contexte optionnel pour déclencher une notification in-app après changement de statut.
 *
 * - a_relire  : notifie le manager (dispatch_manager_id) que le travail est prêt à relire
 * - a_valider : notifie le worker (assignee_id) que le manager a validé
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
}

/**
 * Fournit une mutation pour mettre à jour le be_status d'une tâche.
 * Envoie une notification in-app au bon destinataire selon la transition :
 *   en_cours → a_relire  : notifie le manager (dispatch_manager_id)
 *   a_relire → a_valider : notifie le worker (assignee_id)
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
      const { data, error } = await sb
        .from('tasks')
        .update({ be_status: status })
        .eq('id', taskId)
        .select('id, be_status, be_project_id')
        .single();
      if (error) throw error;

      // ── Notification in-app ──────────────────────────────────────────────
      if (notify) {
        const projectSuffix = notify.projectCode ? ` — ${notify.projectCode}` : '';

        // en_cours → a_relire : prévenir le manager que le travail est soumis
        if (status === 'a_relire' && notify.dispatchManagerId && notify.dispatchManagerId !== user?.id) {
          await sb.from('notifications').insert({
            user_id: notify.dispatchManagerId,
            title: `À relire : ${notify.taskLabel}`,
            message: `Une tâche est prête pour votre relecture${projectSuffix}.`,
            type: 'be_a_relire',
            related_entity_type: 'task',
            related_entity_id: taskId,
          });
        }

        // a_relire → a_valider : prévenir le worker que le manager a validé
        if (status === 'a_valider' && notify.assigneeId && notify.assigneeId !== user?.id) {
          await sb.from('notifications').insert({
            user_id: notify.assigneeId,
            title: `Validé : ${notify.taskLabel}`,
            message: `Votre travail a été validé par le manager${projectSuffix}.`,
            type: 'be_a_valider',
            related_entity_type: 'task',
            related_entity_id: taskId,
          });
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

  return {
    updateBEStatus,
    isUpdating: mutation.isPending,
  };
}
