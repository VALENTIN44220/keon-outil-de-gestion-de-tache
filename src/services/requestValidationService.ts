/**
 * Service de validation des demandes (avant création des tâches)
 * Distinct du service de validation des tâches (taskStatusService)
 */

import { supabase } from '@/integrations/supabase/client';

export type RequestValidationAction = 'approve' | 'refuse_cancel' | 'refuse_return';

export interface RequestValidationResult {
  success: boolean;
  error?: string;
}

/**
 * Labels pour le statut de validation de la demande
 */
export const REQUEST_VALIDATION_STATUS_LABELS: Record<string, string> = {
  'none': 'Aucune',
  'pending_level_1': 'En attente de validation',
  'pending_level_2': 'En attente de validation (N2)',
  'validated': 'Validée',
  'refused': 'Refusée',
  'returned': 'Retournée au demandeur',
};

/**
 * Valide une demande au niveau donné
 */
export async function validateRequest(
  requestId: string,
  level: 1 | 2,
  validatorProfileId: string,
  comment?: string
): Promise<RequestValidationResult> {
  try {
    // Récupérer la demande
    const { data: request, error: fetchError } = await (supabase as any)
      .from('tasks')
      .select('*, request_validation_status, request_validator_type_2, request_validator_id_2')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      return { success: false, error: 'Demande non trouvée' };
    }

    const hasLevel2 = request.request_validator_type_2 != null;

    if (level === 1) {
      if (hasLevel2) {
        // Pass to level 2
        await (supabase as any)
          .from('tasks')
          .update({
            request_validation_status: 'pending_level_2',
            request_validated_by_1: validatorProfileId,
            request_validation_1_at: new Date().toISOString(),
            request_validation_1_comment: comment || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', requestId);
      } else {
        // Final validation → start workflow
        await finalizeRequestValidation(requestId, validatorProfileId, comment, 1);
      }
    } else {
      // Level 2 final validation
      await (supabase as any)
        .from('tasks')
        .update({
          request_validated_by_2: validatorProfileId,
          request_validation_2_at: new Date().toISOString(),
          request_validation_2_comment: comment || null,
        })
        .eq('id', requestId);

      await finalizeRequestValidation(requestId, validatorProfileId, comment, 2);
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error validating request:', err);
    return { success: false, error: err.message || 'Erreur' };
  }
}

/**
 * Refuse une demande
 */
export async function refuseRequest(
  requestId: string,
  level: 1 | 2,
  validatorProfileId: string,
  action: 'cancel' | 'return',
  comment: string
): Promise<RequestValidationResult> {
  try {
    const newStatus = action === 'cancel' ? 'refused' : 'returned';
    const taskStatus = action === 'cancel' ? 'cancelled' : 'todo';

    const updates: Record<string, unknown> = {
      request_validation_status: newStatus,
      request_validation_refusal_action: action,
      status: taskStatus,
      updated_at: new Date().toISOString(),
      [`request_validated_by_${level}`]: validatorProfileId,
      [`request_validation_${level}_at`]: new Date().toISOString(),
      [`request_validation_${level}_comment`]: comment,
    };

    const { error } = await (supabase as any)
      .from('tasks')
      .update(updates)
      .eq('id', requestId);

    if (error) throw error;

    // If cancelled, cancel sub-processes too
    if (action === 'cancel') {
      await supabase
        .from('request_sub_processes')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('request_id', requestId);
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error refusing request:', err);
    return { success: false, error: err.message || 'Erreur' };
  }
}

/**
 * Re-soumettre une demande retournée (par le demandeur)
 */
export async function resubmitRequest(
  requestId: string
): Promise<RequestValidationResult> {
  try {
    const { error } = await (supabase as any)
      .from('tasks')
      .update({
        request_validation_status: 'pending_level_1',
        request_validation_refusal_action: null,
        status: 'todo',
        updated_at: new Date().toISOString(),
        // Reset validation fields
        request_validated_by_1: null,
        request_validation_1_at: null,
        request_validation_1_comment: null,
        request_validated_by_2: null,
        request_validation_2_at: null,
        request_validation_2_comment: null,
      })
      .eq('id', requestId);

    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erreur' };
  }
}

/**
 * Finalize: mark as validated and start workflow
 */
async function finalizeRequestValidation(
  requestId: string,
  validatorProfileId: string,
  comment: string | undefined,
  level: number
) {
  // 1. Update request status
  await (supabase as any)
    .from('tasks')
    .update({
      request_validation_status: 'validated',
      status: 'in-progress',
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  // 2. Activate sub-processes (les tâches sont créées par le trigger auto-spawn côté DB)
  await supabase
    .from('request_sub_processes')
    .update({ status: 'pending', updated_at: new Date().toISOString() })
    .eq('request_id', requestId);
}
