import { supabase } from '@/integrations/supabase/client';
import type { WfAssignmentRule } from '@/types/workflow';

export interface EnrichedAssignmentRule extends WfAssignmentRule {
  display_name: string;
}

interface BaseRule {
  id: string;
  name: string;
  type: 'user' | 'manager' | 'requester' | 'group' | 'department' | 'job_title';
  target_id: string | null;
}

function ruleKey(type: string, targetId: string | null) {
  return `${type}:${targetId || 'null'}`;
}

export async function syncWorkflowAssignmentRulesCatalog() {
  const [rulesRes, profilesRes, groupsRes, departmentsRes, jobTitlesRes] = await Promise.all([
    supabase.from('wf_assignment_rules').select('id, name, type, target_id'),
    supabase.from('profiles').select('id, user_id, display_name').eq('status', 'active').order('display_name'),
    supabase.from('collaborator_groups').select('id, name').order('name'),
    supabase.from('departments').select('id, name').order('name'),
    supabase.from('job_titles').select('id, name').order('name'),
  ]);

  const existingRules = (rulesRes.data || []) as BaseRule[];
  const existingKeys = new Set(existingRules.map((r) => ruleKey(r.type, r.target_id)));

  const profiles = profilesRes.data || [];
  const groups = groupsRes.data || [];
  const departments = departmentsRes.data || [];
  const jobTitles = jobTitlesRes.data || [];

  const desiredRules: Array<{ name: string; type: BaseRule['type']; target_id: string | null }> = [
    { name: 'Manager du demandeur', type: 'manager', target_id: null },
    { name: 'Demandeur', type: 'requester', target_id: null },
    ...profiles.map((p) => ({
      name: `Utilisateur : ${p.display_name || 'Sans nom'}`,
      type: 'user' as const,
      target_id: p.id,
    })),
    ...groups.map((g) => ({
      name: `Groupe : ${g.name}`,
      type: 'group' as const,
      target_id: g.id,
    })),
    ...departments.map((d) => ({
      name: `Service : ${d.name}`,
      type: 'department' as const,
      target_id: d.id,
    })),
    ...jobTitles.map((j) => ({
      name: `Poste : ${j.name}`,
      type: 'job_title' as const,
      target_id: j.id,
    })),
  ];

  const toInsert = desiredRules.filter((r) => !existingKeys.has(ruleKey(r.type, r.target_id)));

  if (toInsert.length > 0) {
    const { error } = await supabase.from('wf_assignment_rules').insert(toInsert);
    if (error) {
      // ne bloque pas le chargement si l'utilisateur n'a pas le droit d'insérer
      console.warn('Unable to sync wf_assignment_rules catalog:', error.message);
    }
  }
}

export async function fetchEnrichedWorkflowAssignmentRules(): Promise<EnrichedAssignmentRule[]> {
  await syncWorkflowAssignmentRulesCatalog();

  const [rulesRes, profilesRes, groupsRes, departmentsRes, jobTitlesRes] = await Promise.all([
    supabase.from('wf_assignment_rules').select('*').order('name'),
    supabase.from('profiles').select('id, user_id, display_name').eq('status', 'active'),
    supabase.from('collaborator_groups').select('id, name'),
    supabase.from('departments').select('id, name'),
    supabase.from('job_titles').select('id, name'),
  ]);

  const rawRules = rulesRes.data || [];
  const profileById = new Map((profilesRes.data || []).map((p) => [p.id, p.display_name || 'Sans nom']));
  const groupById = new Map((groupsRes.data || []).map((g) => [g.id, g.name]));
  const deptById = new Map((departmentsRes.data || []).map((d) => [d.id, d.name]));
  const jobById = new Map((jobTitlesRes.data || []).map((j) => [j.id, j.name]));

  const seen = new Set<string>();
  const enriched: EnrichedAssignmentRule[] = [];

  for (const rule of rawRules) {
    const key = ruleKey(rule.type, rule.target_id);
    if (seen.has(key)) continue;
    seen.add(key);

    let displayName = rule.name;

    if (rule.type === 'department' && rule.target_id) {
      displayName = `Service : ${deptById.get(rule.target_id) || rule.target_id}`;
    } else if (rule.type === 'group' && rule.target_id) {
      displayName = `Groupe : ${groupById.get(rule.target_id) || rule.target_id}`;
    } else if (rule.type === 'job_title' && rule.target_id) {
      displayName = `Poste : ${jobById.get(rule.target_id) || rule.target_id}`;
    } else if (rule.type === 'user' && rule.target_id) {
      const label = profileById.get(rule.target_id);
      displayName = label ? `Utilisateur : ${label}` : `Utilisateur : ${rule.target_id.slice(0, 8)}`;
    } else if (rule.type === 'manager' && rule.target_id) {
      const label = profileById.get(rule.target_id);
      displayName = label ? `Manager : ${label}` : 'Manager spécifique';
    } else if (rule.type === 'manager') {
      displayName = 'Manager du demandeur';
    } else if (rule.type === 'requester') {
      displayName = 'Demandeur';
    }

    enriched.push({ ...rule, display_name: displayName });
  }

  return enriched;
}
