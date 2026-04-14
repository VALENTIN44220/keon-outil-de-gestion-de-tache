import { supabase } from '@/integrations/supabase/client';

/**
 * Process-level behaviour for how resolved assignment rules become concrete tasks.
 * Stored in `process_templates.settings.assignment_config.assignment_handling`.
 */
export type ProcessAssignmentHandling = 'direct' | 'team_lead_reassignment';

export type ProcessAssignmentScope = 'global' | 'per_subprocess';

export type ProcessAssignmentSettings = {
  assignment_handling: ProcessAssignmentHandling;
  scope: ProcessAssignmentScope;
  default_assignment_rule_id: string | null;
};

const DEFAULT_SETTINGS: ProcessAssignmentSettings = {
  assignment_handling: 'direct',
  scope: 'per_subprocess',
  default_assignment_rule_id: null,
};

function parseAssignmentSettings(settings: Record<string, unknown> | null | undefined): ProcessAssignmentSettings {
  if (!settings) return { ...DEFAULT_SETTINGS };

  const assignmentConfig = settings.assignment_config as Record<string, unknown> | undefined;
  if (!assignmentConfig) return { ...DEFAULT_SETTINGS };

  const handlingRaw = assignmentConfig.assignment_handling;
  const assignment_handling: ProcessAssignmentHandling =
    handlingRaw === 'team_lead_reassignment' ? 'team_lead_reassignment' : 'direct';

  const scopeRaw = assignmentConfig.scope;
  // Seuls `global` et `per_subprocess` sont supportés (l'ancien scope `conditional` retombe ici sur per_subprocess).
  const scope: ProcessAssignmentScope = scopeRaw === 'global' ? 'global' : 'per_subprocess';

  const default_assignment_rule_id =
    typeof assignmentConfig.default_assignment_rule_id === 'string'
      ? assignmentConfig.default_assignment_rule_id
      : null;

  return {
    assignment_handling,
    scope,
    default_assignment_rule_id,
  };
}

export async function fetchProcessAssignmentSettings(
  processTemplateId: string | undefined | null,
): Promise<ProcessAssignmentSettings> {
  if (!processTemplateId) return { ...DEFAULT_SETTINGS };

  const { data, error } = await supabase
    .from('process_templates')
    .select('settings')
    .eq('id', processTemplateId)
    .maybeSingle();

  if (error || !data?.settings) return { ...DEFAULT_SETTINGS };

  return parseAssignmentSettings(data.settings as Record<string, unknown>);
}

/**
 * Choisit l'id de règle `wf_assignment_rules` pour les tâches générées à la création de demande
 * (`generatePendingAssignments`). Les règles par sous-processus vivent sur les étapes de workflow ;
 * ce champ reste le fallback éventuel au niveau processus.
 */
export function pickAssignmentRuleIdForPendingTask(settings: ProcessAssignmentSettings): string | null {
  return settings.default_assignment_rule_id;
}

export async function fetchProcessAssignmentHandling(
  processTemplateId: string | undefined | null,
): Promise<ProcessAssignmentHandling> {
  const s = await fetchProcessAssignmentSettings(processTemplateId);
  return s.assignment_handling;
}
