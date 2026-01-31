/**
 * Hook pour l'exécution des sous-processus standard
 * Implémente le cycle de vie S1-S4 obligatoire
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { emitWorkflowEvent } from '@/services/workflowEventService';
import type { StandardSubProcessNodeConfig } from '@/types/workflow';
import type { TaskStatus } from '@/types/task';

interface SubProcessExecutionContext {
  requestId: string;
  requestTitle: string;
  requesterId: string;
  requesterName?: string;
  processTemplateId?: string;
  workflowRunId?: string;
}

interface TaskCreationResult {
  taskId: string;
  title: string;
  status: TaskStatus;
  assigneeId?: string;
}

export function useStandardSubProcessExecution() {
  const { user, profile } = useAuth();

  /**
   * S1 - Création des tâches du sous-processus
   * Statut initial: 'todo' (direct) ou 'to_assign' (manager)
   */
  const createSubProcessTasks = useCallback(async (
    config: StandardSubProcessNodeConfig,
    context: SubProcessExecutionContext
  ): Promise<TaskCreationResult[]> => {
    if (!user) {
      toast.error('Utilisateur non connecté');
      return [];
    }

    const { sub_process_template_id } = config;
    if (!sub_process_template_id) {
      toast.error('Sous-processus cible non défini');
      return [];
    }

    try {
      // Récupérer les templates de tâches du sous-processus
      const { data: taskTemplates, error: templatesError } = await supabase
        .from('task_templates')
        .select('*')
        .eq('sub_process_template_id', sub_process_template_id)
        .order('order_index', { ascending: true });

      if (templatesError) throw templatesError;
      if (!taskTemplates || taskTemplates.length === 0) {
        console.warn('Aucune tâche définie pour ce sous-processus');
        return [];
      }

      // Déterminer le mode d'affectation
      const isDirect = config.assignment_mode === 'direct';
      const initialStatus: TaskStatus = isDirect ? 'todo' : 'to_assign';

      // Déterminer l'assignee selon le mode
      let assigneeId: string | undefined;
      if (isDirect) {
        if (config.assignee_type === 'user' && config.assignee_id) {
          assigneeId = config.assignee_id;
        } else if (config.assignee_type === 'group' && config.group_id) {
          // Pour un groupe, on assigne au premier membre ou on laisse vide
          const { data: members } = await supabase
            .from('collaborator_group_members')
            .select('user_id')
            .eq('group_id', config.group_id)
            .limit(1);
          assigneeId = members?.[0]?.user_id;
        }
      } else {
        // Mode manager - tâches "à affecter"
        assigneeId = await resolveManagerId(config, context.requesterId);
      }

      // Créer l'entrée dans request_sub_processes
      const { data: subProcessRun, error: spRunError } = await supabase
        .from('request_sub_processes')
        .insert({
          request_id: context.requestId,
          sub_process_template_id,
          status: 'running',
          started_at: new Date().toISOString(),
          workflow_run_id: context.workflowRunId,
        })
        .select()
        .single();

      if (spRunError) throw spRunError;

      const createdTasks: TaskCreationResult[] = [];
      const today = new Date();

      // Créer les tâches
      for (const template of taskTemplates) {
        const dueDate = template.default_duration_days
          ? new Date(today.getTime() + template.default_duration_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          : null;

        const { data: newTask, error: taskError } = await supabase
          .from('tasks')
          .insert({
            title: template.title,
            description: template.description,
            priority: template.priority || 'medium',
            status: initialStatus,
            type: 'task',
            due_date: dueDate,
            user_id: user.id,
            assignee_id: assigneeId,
            parent_request_id: context.requestId,
            source_process_template_id: context.processTemplateId,
            source_sub_process_template_id: sub_process_template_id,
            parent_sub_process_run_id: subProcessRun.id,
            workflow_run_id: context.workflowRunId,
            validation_level_1: template.validation_level_1 || 'none',
            validation_level_2: template.validation_level_2 || 'none',
            category_id: template.category_id,
            subcategory_id: template.subcategory_id,
          })
          .select()
          .single();

        if (taskError) {
          console.error('Error creating task:', taskError);
          continue;
        }

        // Copier la checklist du template
        await copyTemplateChecklist(template.id, newTask.id);

        createdTasks.push({
          taskId: newTask.id,
          title: newTask.title,
          status: initialStatus,
          assigneeId,
        });

        // Émettre événement de création
        await emitWorkflowEvent(
          'task_created',
          'task',
          newTask.id,
          {
            task_title: newTask.title,
            request_id: context.requestId,
            sub_process_template_id,
            assignee_id: assigneeId,
          },
          context.workflowRunId
        );
      }

      return createdTasks;
    } catch (error) {
      console.error('Error creating sub-process tasks:', error);
      toast.error('Erreur lors de la création des tâches');
      return [];
    }
  }, [user]);

  /**
   * S2 - Notifications de création
   * Notifie le demandeur et l'affecté/manager
   */
  const sendCreationNotifications = useCallback(async (
    config: StandardSubProcessNodeConfig,
    context: SubProcessExecutionContext,
    createdTasks: TaskCreationResult[]
  ): Promise<void> => {
    if (config.notify_on_create === false) return;
    if (createdTasks.length === 0) return;

    try {
      // Récupérer le nom du sous-processus
      const { data: sp } = await supabase
        .from('sub_process_templates')
        .select('name')
        .eq('id', config.sub_process_template_id!)
        .single();

      const spName = sp?.name || 'Sous-processus';

      // Notification au demandeur
      await emitWorkflowEvent(
        'request_created',
        'request',
        context.requestId,
        {
          requester_id: context.requesterId,
          request_title: context.requestTitle,
          custom_data: {
            sub_process_name: spName,
            task_count: createdTasks.length,
          },
        },
        context.workflowRunId
      );

      // Notification à l'affecté ou au manager
      const assigneeId = createdTasks[0]?.assigneeId;
      if (assigneeId) {
        const eventType = config.assignment_mode === 'direct' ? 'task_assigned' : 'task_to_assign';
        
        await emitWorkflowEvent(
          eventType,
          'task',
          createdTasks[0].taskId,
          {
            assignee_id: assigneeId,
            task_title: `${createdTasks.length} tâche(s) - ${spName}`,
            request_title: context.requestTitle,
            requester_name: context.requesterName,
          },
          context.workflowRunId
        );
      }
    } catch (error) {
      console.error('Error sending creation notifications:', error);
    }
  }, []);

  /**
   * S3 - Gestion des notifications de changement d'état
   * (Géré automatiquement par le trigger DB + workflowEventService)
   */

  /**
   * S4 - Vérification de clôture et notification finale
   */
  const checkAndNotifyCompletion = useCallback(async (
    subProcessRunId: string,
    config: StandardSubProcessNodeConfig,
    context: SubProcessExecutionContext
  ): Promise<boolean> => {
    try {
      // Vérifier si toutes les tâches sont terminées
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, status')
        .eq('parent_sub_process_run_id', subProcessRunId);

      if (!tasks || tasks.length === 0) return false;

      const allCompleted = tasks.every(t => 
        t.status === 'done' || t.status === 'validated'
      );

      if (allCompleted) {
        // Marquer le sous-processus comme terminé
        await supabase
          .from('request_sub_processes')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', subProcessRunId);

        // Notification de clôture (S4)
        if (config.notify_on_close !== false) {
          await emitWorkflowEvent(
            'sub_process_completed',
            'request',
            subProcessRunId,
            {
              request_id: context.requestId,
              requester_id: context.requesterId,
              custom_data: {
                sub_process_name: config.sub_process_name,
              },
            },
            context.workflowRunId
          );
        }

        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking completion:', error);
      return false;
    }
  }, []);

  /**
   * Exécute le cycle complet S1-S4 pour un sous-processus standard
   */
  const executeStandardSubProcess = useCallback(async (
    nodeType: string,
    config: StandardSubProcessNodeConfig,
    context: SubProcessExecutionContext
  ): Promise<{ success: boolean; taskCount: number; subProcessRunId?: string }> => {
    if (!config.sub_process_template_id) {
      return { success: false, taskCount: 0 };
    }

    // Déterminer le mode d'affectation basé sur le type de nœud
    const effectiveConfig: StandardSubProcessNodeConfig = {
      ...config,
      assignment_mode: nodeType.includes('direct') ? 'direct' : 'manager',
      validation_levels: nodeType.includes('validation2') ? 2 
        : nodeType.includes('validation1') ? 1 
        : 0,
    };

    // S1: Création des tâches
    const createdTasks = await createSubProcessTasks(effectiveConfig, context);
    
    if (createdTasks.length === 0) {
      return { success: false, taskCount: 0 };
    }

    // S2: Notifications de création
    await sendCreationNotifications(effectiveConfig, context, createdTasks);

    // S3: Configuré automatiquement via trigger
    // S4: Sera appelé quand les tâches seront terminées

    // Récupérer l'ID du sous-processus run
    const { data: spRun } = await supabase
      .from('request_sub_processes')
      .select('id')
      .eq('request_id', context.requestId)
      .eq('sub_process_template_id', config.sub_process_template_id)
      .single();

    toast.success(`${createdTasks.length} tâche(s) créée(s)`);

    return {
      success: true,
      taskCount: createdTasks.length,
      subProcessRunId: spRun?.id,
    };
  }, [createSubProcessTasks, sendCreationNotifications]);

  /**
   * Gestion des validations pour les blocs avec validation
   */
  const handleValidation = useCallback(async (
    taskId: string,
    decision: 'approved' | 'rejected',
    validationLevel: 1 | 2,
    comment?: string
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (taskError || !task) return false;

      if (decision === 'approved') {
        // Déterminer le prochain statut
        const needsLevel2 = validationLevel === 1 && task.validation_level_2 !== 'none';
        const newStatus: TaskStatus = needsLevel2 ? 'pending_validation_2' : 'validated';

        await supabase
          .from('tasks')
          .update({
            status: newStatus,
            [`validation_${validationLevel}_status`]: 'validated',
            [`validation_${validationLevel}_at`]: new Date().toISOString(),
            [`validation_${validationLevel}_by`]: profile?.id,
            [`validation_${validationLevel}_comment`]: comment,
          })
          .eq('id', taskId);
      } else {
        // Rejet → statut "review"
        await supabase
          .from('tasks')
          .update({
            status: 'review',
            [`validation_${validationLevel}_status`]: 'refused',
            [`validation_${validationLevel}_at`]: new Date().toISOString(),
            [`validation_${validationLevel}_by`]: profile?.id,
            [`validation_${validationLevel}_comment`]: comment,
          })
          .eq('id', taskId);
      }

      // Émettre événement
      await emitWorkflowEvent(
        'validation_decided',
        'task',
        taskId,
        {
          decision,
          validation_level: validationLevel,
          comment,
          validator_id: profile?.id,
        }
      );

      return true;
    } catch (error) {
      console.error('Error handling validation:', error);
      return false;
    }
  }, [user, profile]);

  return {
    executeStandardSubProcess,
    createSubProcessTasks,
    sendCreationNotifications,
    checkAndNotifyCompletion,
    handleValidation,
  };
}

/**
 * Résout l'ID du manager selon la configuration
 */
async function resolveManagerId(
  config: StandardSubProcessNodeConfig,
  requesterId: string
): Promise<string | undefined> {
  if (config.manager_type === 'specific_user' && config.manager_id) {
    return config.manager_id;
  }

  if (config.manager_type === 'requester_manager' || !config.manager_type) {
    // Obtenir le manager du demandeur
    const { data: requester } = await supabase
      .from('profiles')
      .select('manager_id')
      .eq('id', requesterId)
      .single();
    
    return requester?.manager_id || undefined;
  }

  if (config.manager_type === 'target_manager') {
    // Obtenir le manager cible depuis le template du sous-processus
    if (config.sub_process_template_id) {
      const { data: sp } = await supabase
        .from('sub_process_templates')
        .select('target_manager_id')
        .eq('id', config.sub_process_template_id)
        .single();
      
      return sp?.target_manager_id || undefined;
    }
  }

  return undefined;
}

/**
 * Copie la checklist d'un template vers une tâche
 */
async function copyTemplateChecklist(
  templateId: string,
  taskId: string
): Promise<void> {
  try {
    const { data: checklistItems } = await supabase
      .from('task_template_checklists')
      .select('*')
      .eq('task_template_id', templateId)
      .order('order_index');

    if (checklistItems && checklistItems.length > 0) {
      await supabase.from('task_checklists').insert(
        checklistItems.map(item => ({
          task_id: taskId,
          title: item.title,
          order_index: item.order_index,
          is_completed: false,
        }))
      );
    }
  } catch (error) {
    console.error('Error copying checklist:', error);
  }
}
