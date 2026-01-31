/**
 * Service centralisé pour l'émission et le traitement des événements workflow
 * Implémente le pattern Event-Driven pour les notifications et le workflow engine
 */

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

// Types d'événements supportés
export type WorkflowEventType =
  | 'request_created'
  | 'request_updated'
  | 'task_created'
  | 'task_assigned'
  | 'task_to_assign'
  | 'task_status_changed'
  | 'task_completed'
  | 'validation_requested'
  | 'validation_decided'
  | 'sub_process_started'
  | 'sub_process_completed'
  | 'process_completed'
  | 'checklist_item_completed'
  | 'comment_added'
  | 'reminder_triggered';

export type EntityType = 'task' | 'request' | 'workflow_run' | 'validation';

export interface WorkflowEvent {
  id: string;
  event_type: WorkflowEventType;
  entity_type: EntityType;
  entity_id: string;
  run_id?: string;
  triggered_by?: string;
  payload: Record<string, unknown>;
  processed: boolean;
  processed_at?: string;
  error_message?: string;
  created_at: string;
}

export interface EventPayload {
  // Common fields
  task_id?: string;
  request_id?: string;
  run_id?: string;
  
  // Status change
  from_status?: string;
  to_status?: string;
  
  // Assignment
  assignee_id?: string;
  assigner_id?: string;
  
  // Validation
  validator_id?: string;
  decision?: 'approved' | 'rejected';
  comment?: string;
  validation_level?: number;
  
  // Sub-process
  sub_process_template_id?: string;
  sub_process_run_id?: string;
  
  // Notification context
  requester_id?: string;
  requester_name?: string;
  task_title?: string;
  request_title?: string;
  
  // Custom data
  custom_data?: Record<string, unknown>;
}

/**
 * Émet un événement workflow
 */
export async function emitWorkflowEvent(
  eventType: WorkflowEventType,
  entityType: EntityType,
  entityId: string,
  payload: EventPayload = {},
  runId?: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('workflow_events')
      .insert({
        event_type: eventType,
        entity_type: entityType,
        entity_id: entityId,
        run_id: runId,
        payload: payload as unknown as Json,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error emitting workflow event:', error);
      return null;
    }

    // Traitement immédiat des événements critiques
    if (shouldProcessImmediately(eventType)) {
      await processEvent(data.id);
    }

    return data.id;
  } catch (error) {
    console.error('Error emitting workflow event:', error);
    return null;
  }
}

/**
 * Détermine si un événement doit être traité immédiatement
 */
function shouldProcessImmediately(eventType: WorkflowEventType): boolean {
  // Événements critiques traités immédiatement
  const immediateEvents: WorkflowEventType[] = [
    'request_created',
    'task_status_changed',
    'validation_decided',
    'sub_process_completed',
    'process_completed',
  ];
  return immediateEvents.includes(eventType);
}

/**
 * Traite un événement spécifique
 */
export async function processEvent(eventId: string): Promise<boolean> {
  try {
    // Récupérer l'événement
    const { data: event, error: fetchError } = await supabase
      .from('workflow_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (fetchError || !event) {
      console.error('Event not found:', eventId);
      return false;
    }

    const eventType = event.event_type as WorkflowEventType;
    const payload = event.payload as EventPayload;

    // Dispatcher vers le handler approprié
    switch (eventType) {
      case 'request_created':
        await handleRequestCreated(event.entity_id, payload);
        break;
      case 'task_status_changed':
        await handleTaskStatusChanged(event.entity_id, payload);
        break;
      case 'task_assigned':
        await handleTaskAssigned(event.entity_id, payload);
        break;
      case 'validation_decided':
        await handleValidationDecided(event.entity_id, payload);
        break;
      case 'sub_process_completed':
        await handleSubProcessCompleted(event.entity_id, payload);
        break;
      case 'process_completed':
        await handleProcessCompleted(event.entity_id, payload);
        break;
      default:
        console.log(`Event type ${eventType} not handled yet`);
    }

    // Marquer comme traité
    await supabase
      .from('workflow_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq('id', eventId);

    return true;
  } catch (error) {
    console.error('Error processing event:', error);
    
    // Enregistrer l'erreur
    await supabase
      .from('workflow_events')
      .update({
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', eventId);

    return false;
  }
}

/**
 * Handler: Demande créée
 */
async function handleRequestCreated(requestId: string, payload: EventPayload): Promise<void> {
  // Créer notification pour le demandeur
  await createNotification({
    recipient_id: payload.requester_id,
    type: 'request_created',
    title: 'Demande créée',
    body: `Votre demande "${payload.request_title || 'Sans titre'}" a été créée.`,
    entity_type: 'request',
    entity_id: requestId,
  });

  // Si des sous-processus sont sélectionnés, notifier les managers concernés
  if (payload.custom_data?.selected_sub_processes) {
    const subProcessIds = payload.custom_data.selected_sub_processes as string[];
    
    for (const spId of subProcessIds) {
      // Récupérer le manager cible du sous-processus
      const { data: sp } = await supabase
        .from('sub_process_templates')
        .select('target_manager_id, name')
        .eq('id', spId)
        .single();

      if (sp?.target_manager_id) {
        await createNotification({
          recipient_id: sp.target_manager_id,
          type: 'task_to_assign',
          title: 'Nouvelles tâches à affecter',
          body: `Des tâches du sous-processus "${sp.name}" sont à affecter.`,
          entity_type: 'request',
          entity_id: requestId,
        });
      }
    }
  }
}

/**
 * Handler: Changement de statut de tâche
 */
async function handleTaskStatusChanged(taskId: string, payload: EventPayload): Promise<void> {
  // Récupérer la tâche avec ses infos
  const { data: task } = await supabase
    .from('tasks')
    .select(`
      id, title, type, parent_request_id, assignee_id,
      parent_request:tasks!parent_request_id(user_id, title)
    `)
    .eq('id', taskId)
    .single();

  if (!task) return;

  const requesterId = task.parent_request?.user_id;
  const fromStatus = payload.from_status;
  const toStatus = payload.to_status;

  // Notifier le demandeur des changements d'état (S3 du standard)
  if (requesterId && task.type !== 'request') {
    await createNotification({
      recipient_id: requesterId,
      type: 'task_status_changed',
      title: 'Avancement de votre demande',
      body: `La tâche "${task.title}" est passée de "${fromStatus}" à "${toStatus}".`,
      entity_type: 'task',
      entity_id: taskId,
    });
  }

  // Si tâche terminée, vérifier si sous-processus complet
  if (toStatus === 'done' || toStatus === 'validated') {
    await checkSubProcessCompletion(task.parent_request_id, taskId);
  }
}

/**
 * Handler: Tâche affectée
 */
async function handleTaskAssigned(taskId: string, payload: EventPayload): Promise<void> {
  if (!payload.assignee_id) return;

  // Récupérer la tâche
  const { data: task } = await supabase
    .from('tasks')
    .select('title')
    .eq('id', taskId)
    .single();

  await createNotification({
    recipient_id: payload.assignee_id,
    type: 'task_assigned',
    title: 'Nouvelle tâche assignée',
    body: `La tâche "${task?.title || 'Sans titre'}" vous a été assignée.`,
    entity_type: 'task',
    entity_id: taskId,
  });
}

/**
 * Handler: Décision de validation
 */
async function handleValidationDecided(entityId: string, payload: EventPayload): Promise<void> {
  const { data: task } = await supabase
    .from('tasks')
    .select('title, user_id, parent_request_id')
    .eq('id', entityId)
    .single();

  if (!task) return;

  const isApproved = payload.decision === 'approved';
  const title = isApproved ? 'Validation approuvée' : 'Validation refusée';
  const body = isApproved
    ? `La tâche "${task.title}" a été validée.`
    : `La tâche "${task.title}" a été refusée. ${payload.comment || ''}`;

  // Notifier le demandeur
  if (task.parent_request_id) {
    const { data: request } = await supabase
      .from('tasks')
      .select('user_id')
      .eq('id', task.parent_request_id)
      .single();

    if (request?.user_id) {
      await createNotification({
        recipient_id: request.user_id,
        type: 'validation_decided',
        title,
        body,
        entity_type: 'task',
        entity_id: entityId,
      });
    }
  }
}

/**
 * Handler: Sous-processus terminé
 */
async function handleSubProcessCompleted(subProcessRunId: string, payload: EventPayload): Promise<void> {
  // Récupérer le sous-processus run
  const { data: spRun } = await supabase
    .from('request_sub_processes')
    .select(`
      id, request_id,
      sub_process_template:sub_process_templates(name),
      request:tasks!request_id(user_id, title)
    `)
    .eq('id', subProcessRunId)
    .single();

  if (!spRun) return;

  // Notifier le demandeur
  if (spRun.request?.user_id) {
    await createNotification({
      recipient_id: spRun.request.user_id,
      type: 'sub_process_completed',
      title: 'Sous-processus terminé',
      body: `Le sous-processus "${spRun.sub_process_template?.name}" de votre demande "${spRun.request.title}" est terminé.`,
      entity_type: 'request',
      entity_id: spRun.request_id,
    });
  }

  // Vérifier si le processus entier est terminé
  await checkProcessCompletion(spRun.request_id);
}

/**
 * Handler: Processus terminé
 */
async function handleProcessCompleted(requestId: string, payload: EventPayload): Promise<void> {
  const { data: request } = await supabase
    .from('tasks')
    .select('user_id, title')
    .eq('id', requestId)
    .single();

  if (!request) return;

  // Notification finale (S4 du standard)
  await createNotification({
    recipient_id: request.user_id,
    type: 'process_completed',
    title: 'Demande clôturée',
    body: `Votre demande "${request.title}" a été entièrement traitée.`,
    entity_type: 'request',
    entity_id: requestId,
  });
}

/**
 * Vérifie si un sous-processus est complet
 */
async function checkSubProcessCompletion(parentRequestId: string | null, taskId: string): Promise<void> {
  if (!parentRequestId) return;

  // Récupérer la source du sous-processus de cette tâche
  const { data: task } = await supabase
    .from('tasks')
    .select('source_sub_process_template_id, parent_sub_process_run_id')
    .eq('id', taskId)
    .single();

  if (!task?.source_sub_process_template_id) return;

  // Récupérer toutes les tâches de ce sous-processus
  const { data: tasks } = await supabase
    .from('tasks')
    .select('status')
    .eq('parent_request_id', parentRequestId)
    .eq('source_sub_process_template_id', task.source_sub_process_template_id);

  if (!tasks) return;

  // Vérifier si toutes sont terminées
  const allCompleted = tasks.every(t => t.status === 'done' || t.status === 'validated');

  if (allCompleted && task.parent_sub_process_run_id) {
    // Marquer le sous-processus comme terminé
    await supabase
      .from('request_sub_processes')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', task.parent_sub_process_run_id);

    // Émettre l'événement
    await emitWorkflowEvent(
      'sub_process_completed',
      'request',
      task.parent_sub_process_run_id,
      { request_id: parentRequestId }
    );
  }
}

/**
 * Vérifie si un processus (demande) est complet
 */
async function checkProcessCompletion(requestId: string): Promise<void> {
  // Récupérer tous les sous-processus de cette demande
  const { data: subProcesses } = await supabase
    .from('request_sub_processes')
    .select('status')
    .eq('request_id', requestId);

  if (!subProcesses || subProcesses.length === 0) return;

  // Vérifier si tous sont terminés
  const allCompleted = subProcesses.every(sp => sp.status === 'completed');

  if (allCompleted) {
    // Mettre à jour le statut de la demande
    await supabase
      .from('tasks')
      .update({ status: 'done' })
      .eq('id', requestId);

    // Émettre l'événement
    await emitWorkflowEvent(
      'process_completed',
      'request',
      requestId,
      {}
    );
  }
}

/**
 * Interface pour création de notification
 */
interface NotificationData {
  recipient_id?: string;
  type: string;
  title: string;
  body: string;
  entity_type: EntityType;
  entity_id: string;
}

/**
 * Crée une notification in-app (et potentiellement email/teams selon préférences)
 */
async function createNotification(data: NotificationData): Promise<void> {
  if (!data.recipient_id) return;

  try {
    // Vérifier les préférences de notification
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('channel, enabled')
      .eq('user_id', data.recipient_id)
      .eq('event_type', data.type);

    const enabledChannels = prefs?.filter(p => p.enabled).map(p => p.channel) || ['in_app'];

    // Créer les notifications selon les canaux activés
    for (const channel of enabledChannels) {
      await supabase
        .from('workflow_notifications')
        .insert([{
          channel: channel as 'email' | 'in_app' | 'teams',
          recipient_type: 'user' as const,
          recipient_id: data.recipient_id,
          subject: data.title,
          body: data.body,
          status: 'pending' as const,
          run_id: null,
          node_id: 'system',
        }]);
    }
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

/**
 * Récupère les événements non traités
 */
export async function getUnprocessedEvents(limit: number = 100): Promise<WorkflowEvent[]> {
  const { data, error } = await supabase
    .from('workflow_events')
    .select('*')
    .eq('processed', false)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching unprocessed events:', error);
    return [];
  }

  return (data || []) as WorkflowEvent[];
}

/**
 * Traite tous les événements en attente
 */
export async function processAllPendingEvents(): Promise<{ processed: number; errors: number }> {
  const events = await getUnprocessedEvents();
  let processed = 0;
  let errors = 0;

  for (const event of events) {
    const success = await processEvent(event.id);
    if (success) {
      processed++;
    } else {
      errors++;
    }
  }

  return { processed, errors };
}
