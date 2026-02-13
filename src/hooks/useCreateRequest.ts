/**
 * Hook unifié pour la création de demandes
 * Gère les 3 types : tâche perso, affectation directe, processus
 */

import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { emitWorkflowEvent } from '@/services/workflowEventService';
import type { TaskPriority, TaskStatus } from '@/types/task';
import type { Json } from '@/integrations/supabase/types';

export type RequestType = 'personal' | 'direct_assignment' | 'process';

export interface BaseRequestData {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
  categoryId?: string;
  subcategoryId?: string;
}

export interface PersonalTaskData extends BaseRequestData {
  type: 'personal';
}

export interface DirectAssignmentData extends BaseRequestData {
  type: 'direct_assignment';
  assigneeId: string;
  requiresValidation?: boolean;
  validatorId?: string;
}

export interface ProcessRequestData extends BaseRequestData {
  type: 'process';
  processTemplateId: string;
  selectedSubProcessIds: string[];
  targetDepartmentId?: string;
  customFieldValues?: Record<string, unknown>;
}

export type RequestData = PersonalTaskData | DirectAssignmentData | ProcessRequestData;

export interface CreateRequestResult {
  success: boolean;
  requestId?: string;
  error?: string;
  taskCount?: number;
}

export function useCreateRequest() {
  const { user, profile } = useAuth();
  const [isCreating, setIsCreating] = useState(false);

  /**
   * Crée une tâche personnelle (type 1)
   */
  const createPersonalTask = useCallback(async (
    data: PersonalTaskData
  ): Promise<CreateRequestResult> => {
    if (!user || !profile) {
      return { success: false, error: 'Non connecté' };
    }

    try {
      const { data: task, error } = await supabase
        .from('tasks')
        .insert({
          title: data.title,
          description: data.description,
          priority: data.priority || 'medium',
          status: 'todo' as TaskStatus,
          type: 'task',
          due_date: data.dueDate,
          user_id: user.id,
          assignee_id: profile.id, // Assigné à soi-même
          category_id: data.categoryId,
          subcategory_id: data.subcategoryId,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, requestId: task.id, taskCount: 1 };
    } catch (error) {
      console.error('Error creating personal task:', error);
      return { success: false, error: 'Erreur lors de la création' };
    }
  }, [user, profile]);

  /**
   * Crée une tâche avec affectation directe (type 2)
   */
  const createDirectAssignment = useCallback(async (
    data: DirectAssignmentData
  ): Promise<CreateRequestResult> => {
    if (!user || !profile) {
      return { success: false, error: 'Non connecté' };
    }

    try {
      const initialStatus: TaskStatus = data.requiresValidation 
        ? 'pending_validation_1' 
        : 'todo';

      const { data: task, error } = await supabase
        .from('tasks')
        .insert({
          title: data.title,
          description: data.description,
          priority: data.priority || 'medium',
          status: initialStatus,
          type: 'task',
          due_date: data.dueDate,
          user_id: user.id,
          assignee_id: data.assigneeId,
          requester_id: profile.id,
          category_id: data.categoryId,
          subcategory_id: data.subcategoryId,
          requires_validation: data.requiresValidation || false,
          validator_level_1_id: data.validatorId,
        })
        .select()
        .single();

      if (error) throw error;

      // Notifier l'assigné
      await emitWorkflowEvent(
        'task_assigned',
        'task',
        task.id,
        {
          assignee_id: data.assigneeId,
          task_title: data.title,
          requester_id: profile.id,
          requester_name: profile.display_name,
        }
      );

      return { success: true, requestId: task.id, taskCount: 1 };
    } catch (error) {
      console.error('Error creating direct assignment:', error);
      return { success: false, error: 'Erreur lors de la création' };
    }
  }, [user, profile]);

  /**
   * Crée une demande de type processus (type 3)
   */
  const createProcessRequest = useCallback(async (
    data: ProcessRequestData
  ): Promise<CreateRequestResult> => {
    if (!user || !profile) {
      return { success: false, error: 'Non connecté' };
    }

    if (!data.selectedSubProcessIds || data.selectedSubProcessIds.length === 0) {
      return { success: false, error: 'Aucun sous-processus sélectionné' };
    }

    try {
      // 0. Check if process has request validation enabled
      const { data: processTemplate } = await (supabase as any)
        .from('process_templates')
        .select('settings')
        .eq('id', data.processTemplateId)
        .single();

      const requestValidationConfig = processTemplate?.settings?.request_validation;
      const hasRequestValidation = requestValidationConfig?.enabled === true;

      // Determine initial status and validation fields
      const initialStatus: TaskStatus = hasRequestValidation ? 'todo' : 'in-progress';
      const requestValidationStatus = hasRequestValidation ? 'pending_level_1' : 'none';

      // Resolve validator for level 1
      let validatorId1: string | null = null;
      let validatorType1: string | null = null;
      if (hasRequestValidation) {
        validatorType1 = requestValidationConfig.level_1.type;
        if (validatorType1 === 'manager') {
          // Use the requester's manager
          validatorId1 = profile.manager_id || null;
        } else {
          validatorId1 = requestValidationConfig.level_1.target_id || null;
        }
      }

      // 1. Créer la demande principale (request)
      const { data: request, error: requestError } = await (supabase as any)
        .from('tasks')
        .insert({
          title: data.title,
          description: data.description,
          priority: data.priority || 'medium',
          status: initialStatus,
          type: 'request',
          due_date: data.dueDate,
          user_id: user.id,
          requester_id: profile.id,
          source_process_template_id: data.processTemplateId,
          process_template_id: data.processTemplateId,
          target_department_id: data.targetDepartmentId,
          category_id: data.categoryId,
          subcategory_id: data.subcategoryId,
          // Request validation fields
          request_validation_enabled: hasRequestValidation,
          request_validation_status: requestValidationStatus,
          request_validator_type_1: validatorType1,
          request_validator_id_1: validatorId1,
          request_validator_type_2: hasRequestValidation && requestValidationConfig.level_2?.enabled
            ? requestValidationConfig.level_2.type : null,
          request_validator_id_2: hasRequestValidation && requestValidationConfig.level_2?.enabled
            ? (requestValidationConfig.level_2.type === 'manager'
              ? (profile.manager_id || null)
              : requestValidationConfig.level_2.target_id || null)
            : null,
        })
        .select()
        .single();

      if (requestError) throw requestError;

      // 2. Enregistrer les sous-processus sélectionnés
      const subProcessInserts = data.selectedSubProcessIds.map((spId, index) => ({
        request_id: request.id,
        sub_process_template_id: spId,
        status: hasRequestValidation ? 'waiting_validation' : 'pending',
        order_index: index,
      }));

      const { error: spError } = await supabase
        .from('request_sub_processes')
        .insert(subProcessInserts);

      if (spError) throw spError;

      // 3. Sauvegarder les valeurs des champs personnalisés
      if (data.customFieldValues && Object.keys(data.customFieldValues).length > 0) {
        const fieldInserts = Object.entries(data.customFieldValues).map(([fieldId, value]) => ({
          task_id: request.id,
          field_id: fieldId,
          value: typeof value === 'string' ? value : JSON.stringify(value),
        }));

        await supabase.from('request_field_values').insert(fieldInserts);
      }

      // 4. Démarrer le workflow SEULEMENT si pas de validation de demande en attente
      if (!hasRequestValidation) {
        const workflowId = await getActiveWorkflow(data.processTemplateId);
        
        if (workflowId) {
          const { data: workflowRun, error: runError } = await supabase
            .from('workflow_runs')
            .insert([{
              workflow_id: workflowId,
              workflow_version: 1,
              trigger_entity_type: 'request' as const,
              trigger_entity_id: request.id,
              status: 'running' as const,
              context_data: JSON.stringify({
                entityType: 'request',
                entityId: request.id,
                requester_id: profile.id,
                department_id: data.targetDepartmentId,
                selected_sub_processes: data.selectedSubProcessIds,
                custom_fields: data.customFieldValues,
              }) as unknown as Json,
              started_by: user.id,
              execution_log: JSON.stringify([{
                timestamp: new Date().toISOString(),
                action: 'workflow_started',
                details: { triggered_by: user.id }
              }]) as unknown as Json,
            }])
            .select()
            .single();

          if (!runError && workflowRun) {
            await supabase
              .from('tasks')
              .update({ workflow_run_id: workflowRun.id })
              .eq('id', request.id);
          }
        }
      }

      // 5. Émettre l'événement de création
      await emitWorkflowEvent(
        hasRequestValidation ? 'validation_requested' : 'request_created',
        'request',
        request.id,
        {
          request_title: data.title,
          requester_id: profile.id,
          requester_name: profile.display_name,
          validator_id: validatorId1 || undefined,
          custom_data: {
            process_template_id: data.processTemplateId,
            selected_sub_processes: data.selectedSubProcessIds,
            request_validation_enabled: hasRequestValidation,
          },
        }
      );

      return { 
        success: true, 
        requestId: request.id,
        taskCount: data.selectedSubProcessIds.length,
      };
    } catch (error) {
      console.error('Error creating process request:', error);
      return { success: false, error: 'Erreur lors de la création' };
    }
  }, [user, profile]);

  /**
   * Point d'entrée principal - dispatche selon le type
   */
  const createRequest = useCallback(async (
    data: RequestData
  ): Promise<CreateRequestResult> => {
    setIsCreating(true);

    try {
      let result: CreateRequestResult;

      switch (data.type) {
        case 'personal':
          result = await createPersonalTask(data);
          break;
        case 'direct_assignment':
          result = await createDirectAssignment(data);
          break;
        case 'process':
          result = await createProcessRequest(data);
          break;
        default:
          result = { success: false, error: 'Type de demande inconnu' };
      }

      if (result.success) {
        toast.success('Demande créée avec succès');
      } else if (result.error) {
        toast.error(result.error);
      }

      return result;
    } finally {
      setIsCreating(false);
    }
  }, [createPersonalTask, createDirectAssignment, createProcessRequest]);

  return {
    createRequest,
    createPersonalTask,
    createDirectAssignment,
    createProcessRequest,
    isCreating,
  };
}

/**
 * Récupère le workflow actif pour un processus
 */
async function getActiveWorkflow(processTemplateId: string): Promise<string | null> {
  const { data } = await supabase
    .from('workflow_templates')
    .select('id')
    .eq('process_template_id', processTemplateId)
    .eq('status', 'active')
    .eq('is_default', true)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  return data?.id || null;
}
