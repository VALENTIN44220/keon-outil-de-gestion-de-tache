import { supabase } from '@/integrations/supabase/client';

export type WfRuleResolutionContext = {
  /** Profil demandeur (tâche parente `requester_id`) */
  requesterProfileId: string | null;
};

/**
 * Convertit une ligne `wf_assignment_rules` en profil assignable (`tasks.assignee_id`).
 */
export async function resolveWfAssignmentRuleToProfileId(
  ruleId: string,
  ctx: WfRuleResolutionContext,
): Promise<string | undefined> {
  const { data: rule, error } = await supabase
    .from('wf_assignment_rules')
    .select('id, type, target_id')
    .eq('id', ruleId)
    .maybeSingle();

  if (error || !rule) return undefined;

  switch (rule.type) {
    case 'user':
      return rule.target_id || undefined;
    case 'requester':
      return ctx.requesterProfileId || undefined;
    case 'manager': {
      if (rule.target_id) return rule.target_id;
      if (!ctx.requesterProfileId) return undefined;
      const { data: requester } = await supabase
        .from('profiles')
        .select('manager_id')
        .eq('id', ctx.requesterProfileId)
        .maybeSingle();
      return requester?.manager_id || undefined;
    }
    case 'group': {
      if (!rule.target_id) return undefined;
      const { data: members } = await supabase
        .from('collaborator_group_members')
        .select('user_id')
        .eq('group_id', rule.target_id)
        .limit(1);
      return members?.[0]?.user_id;
    }
    case 'department': {
      if (!rule.target_id) return undefined;
      const { data: prof } = await supabase
        .from('profiles')
        .select('id')
        .eq('department_id', rule.target_id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      return prof?.id;
    }
    case 'job_title': {
      if (!rule.target_id) return undefined;
      const { data: prof } = await supabase
        .from('profiles')
        .select('id')
        .eq('job_title_id', rule.target_id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      return prof?.id;
    }
    default:
      return undefined;
  }
}
