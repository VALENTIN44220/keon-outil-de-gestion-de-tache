import { supabase } from '@/integrations/supabase/client';

export type TemplateType = 'process' | 'sub_process' | 'task';

interface VisibilityData {
  companyIds: string[];
  departmentIds: string[];
  groupIds: string[];
  userIds: string[];
}

export async function saveTemplateVisibility(
  templateType: TemplateType,
  templateId: string,
  companyIds: string[],
  departmentIds: string[],
  groupIds: string[] = [],
  userIds: string[] = []
): Promise<void> {
  const prefix = templateType === 'process' ? 'process_template' : templateType === 'sub_process' ? 'sub_process_template' : 'task_template';
  const fkCol = `${prefix}_id`;

  // Helper to clear + re-insert a junction table
  const sync = async (tableSuffix: string, ids: string[], idCol: string) => {
    await supabase.from(`${prefix}_visible_${tableSuffix}` as any).delete().eq(fkCol, templateId);
    if (ids.length > 0) {
      await supabase.from(`${prefix}_visible_${tableSuffix}` as any).insert(
        ids.map(id => ({ [fkCol]: templateId, [idCol]: id }))
      );
    }
  };

  await Promise.all([
    sync('companies', companyIds, 'company_id'),
    sync('departments', departmentIds, 'department_id'),
    sync('groups', groupIds, 'group_id'),
    sync('users', userIds, 'user_id'),
  ]);
}

export async function getTemplateVisibility(
  templateType: TemplateType,
  templateId: string
): Promise<VisibilityData> {
  const prefix = templateType === 'process' ? 'process_template' : templateType === 'sub_process' ? 'sub_process_template' : 'task_template';
  const fkCol = `${prefix}_id`;

  const [companiesRes, departmentsRes, groupsRes, usersRes] = await Promise.all([
    supabase.from(`${prefix}_visible_companies` as any).select('company_id').eq(fkCol, templateId),
    supabase.from(`${prefix}_visible_departments` as any).select('department_id').eq(fkCol, templateId),
    supabase.from(`${prefix}_visible_groups` as any).select('group_id').eq(fkCol, templateId),
    supabase.from(`${prefix}_visible_users` as any).select('user_id').eq(fkCol, templateId),
  ]);

  return {
    companyIds: (companiesRes.data as any[] || []).map((r: any) => r.company_id),
    departmentIds: (departmentsRes.data as any[] || []).map((r: any) => r.department_id),
    groupIds: (groupsRes.data as any[] || []).map((r: any) => r.group_id),
    userIds: (usersRes.data as any[] || []).map((r: any) => r.user_id),
  };
}
