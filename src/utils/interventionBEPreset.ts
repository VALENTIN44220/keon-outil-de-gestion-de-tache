import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

/**
 * Standard preset configuration for "INTERVENTION BE" process sub-processes.
 * This preset is automatically applied during workflow regeneration.
 */

// Validation config: 2 levels - N1=Manager, N2=Requester
export const INTERVENTION_BE_VALIDATION_CONFIG = {
  levels: [
    { level: 1, type: 'manager', userId: null, timing: 'before_close' },
    { level: 2, type: 'requester', userId: null, timing: 'before_close' },
  ],
};

// Notification config: All in-app notifications enabled by default
export const INTERVENTION_BE_NOTIFICATION_CONFIG = {
  subprocess_started: { in_app: true, email: false, teams: false },
  task_assigned: { in_app: true, email: false, teams: false },
  task_status_changed: { in_app: true, email: false, teams: false },
  validation_requested: { in_app: true, email: false, teams: false },
  validation_decided: { in_app: true, email: false, teams: false },
  subprocess_completed: { in_app: true, email: false, teams: false },
};

export const INTERVENTION_BE_PROCESS_NAME = 'INTERVENTION BE';

/**
 * Checks if a process name matches "INTERVENTION BE" (case-insensitive, trimmed)
 */
export function isInterventionBEProcess(processName: string | null | undefined): boolean {
  if (!processName) return false;
  return processName.trim().toUpperCase() === INTERVENTION_BE_PROCESS_NAME;
}

/**
 * Applies the INTERVENTION BE preset to a single sub-process template.
 * 
 * @param subProcessId - The ID of the sub-process template to update
 * @param forceOverwrite - If true, always applies preset. If false, only applies if empty/absent.
 * @returns Object indicating what was updated
 */
export async function applyInterventionBEPresetToSubProcess(
  subProcessId: string,
  forceOverwrite: boolean = false
): Promise<{ validationUpdated: boolean; notificationUpdated: boolean; error?: string }> {
  try {
    // First, fetch the current sub-process template
    const { data: subProcess, error: fetchError } = await supabase
      .from('sub_process_templates')
      .select('id, name, validation_config, form_schema')
      .eq('id', subProcessId)
      .single();

    if (fetchError || !subProcess) {
      return { validationUpdated: false, notificationUpdated: false, error: fetchError?.message || 'Not found' };
    }

    const currentFormSchema = (subProcess.form_schema as Record<string, unknown>) || {};
    const currentValidationConfig = subProcess.validation_config as { levels?: unknown[] } | null;
    const currentNotificationConfig = currentFormSchema.notification_config;

    // Determine what needs updating
    const needsValidationUpdate = forceOverwrite || 
      !currentValidationConfig || 
      !Array.isArray(currentValidationConfig.levels) || 
      currentValidationConfig.levels.length === 0;

    const needsNotificationUpdate = forceOverwrite || 
      !currentNotificationConfig || 
      Object.keys(currentNotificationConfig as object || {}).length === 0;

    if (!needsValidationUpdate && !needsNotificationUpdate) {
      return { validationUpdated: false, notificationUpdated: false };
    }

    // Build update payload
    const updates: Record<string, unknown> = {};

    if (needsValidationUpdate) {
      updates.validation_config = INTERVENTION_BE_VALIDATION_CONFIG as Json;
    }

    if (needsNotificationUpdate) {
      // Merge notification_config into existing form_schema
      const newFormSchema = {
        ...currentFormSchema,
        notification_config: INTERVENTION_BE_NOTIFICATION_CONFIG,
      };
      updates.form_schema = newFormSchema as Json;
    }

    // Apply updates
    const { error: updateError } = await supabase
      .from('sub_process_templates')
      .update(updates)
      .eq('id', subProcessId);

    if (updateError) {
      return { 
        validationUpdated: false, 
        notificationUpdated: false, 
        error: updateError.message 
      };
    }

    console.log(`[INTERVENTION BE Preset] Applied to sub-process ${subProcess.name}:`, {
      validationUpdated: needsValidationUpdate,
      notificationUpdated: needsNotificationUpdate,
    });

    return { 
      validationUpdated: needsValidationUpdate, 
      notificationUpdated: needsNotificationUpdate 
    };
  } catch (error) {
    console.error('[INTERVENTION BE Preset] Error:', error);
    return { 
      validationUpdated: false, 
      notificationUpdated: false, 
      error: String(error) 
    };
  }
}

/**
 * Applies the INTERVENTION BE preset to multiple sub-process templates.
 * Used during workflow regeneration.
 * 
 * @param subProcessIds - Array of sub-process template IDs
 * @param forceOverwrite - If true (regenerate mode), always applies. If false (generate missing), only applies if empty.
 * @returns Summary of updates
 */
export async function applyInterventionBEPresetToSubProcesses(
  subProcessIds: string[],
  forceOverwrite: boolean = false
): Promise<{
  total: number;
  validationPatched: number;
  notificationPatched: number;
  errors: number;
}> {
  const summary = {
    total: subProcessIds.length,
    validationPatched: 0,
    notificationPatched: 0,
    errors: 0,
  };

  for (const spId of subProcessIds) {
    const result = await applyInterventionBEPresetToSubProcess(spId, forceOverwrite);
    
    if (result.error) {
      summary.errors++;
    } else {
      if (result.validationUpdated) summary.validationPatched++;
      if (result.notificationUpdated) summary.notificationPatched++;
    }
  }

  console.log(`[INTERVENTION BE Preset] Batch update summary:`, summary);

  return summary;
}

/**
 * Fetches all sub-process IDs for a given process template
 */
export async function getSubProcessIdsForProcess(processId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('sub_process_templates')
    .select('id')
    .eq('process_template_id', processId);

  if (error) {
    console.error('[INTERVENTION BE Preset] Error fetching sub-processes:', error);
    return [];
  }

  return (data || []).map(sp => sp.id);
}
