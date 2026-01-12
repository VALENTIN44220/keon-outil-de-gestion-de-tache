import { supabase } from '@/integrations/supabase/client';

export type TemplateType = 'process' | 'sub_process' | 'task';

interface VisibilityData {
  companyIds: string[];
  departmentIds: string[];
}

export async function saveTemplateVisibility(
  templateType: TemplateType,
  templateId: string,
  companyIds: string[],
  departmentIds: string[]
): Promise<void> {
  // Delete existing visibility entries using RPC or direct SQL-like queries
  // Since the types aren't synced yet, we use raw queries
  
  if (templateType === 'process') {
    // Delete existing
    await supabase
      .from('process_template_visible_companies' as any)
      .delete()
      .eq('process_template_id', templateId);
    await supabase
      .from('process_template_visible_departments' as any)
      .delete()
      .eq('process_template_id', templateId);
    
    // Insert new company visibility
    if (companyIds.length > 0) {
      await supabase
        .from('process_template_visible_companies' as any)
        .insert(companyIds.map(companyId => ({
          process_template_id: templateId,
          company_id: companyId,
        })));
    }
    
    // Insert new department visibility
    if (departmentIds.length > 0) {
      await supabase
        .from('process_template_visible_departments' as any)
        .insert(departmentIds.map(departmentId => ({
          process_template_id: templateId,
          department_id: departmentId,
        })));
    }
  } else if (templateType === 'sub_process') {
    await supabase
      .from('sub_process_template_visible_companies' as any)
      .delete()
      .eq('sub_process_template_id', templateId);
    await supabase
      .from('sub_process_template_visible_departments' as any)
      .delete()
      .eq('sub_process_template_id', templateId);
    
    if (companyIds.length > 0) {
      await supabase
        .from('sub_process_template_visible_companies' as any)
        .insert(companyIds.map(companyId => ({
          sub_process_template_id: templateId,
          company_id: companyId,
        })));
    }
    
    if (departmentIds.length > 0) {
      await supabase
        .from('sub_process_template_visible_departments' as any)
        .insert(departmentIds.map(departmentId => ({
          sub_process_template_id: templateId,
          department_id: departmentId,
        })));
    }
  } else if (templateType === 'task') {
    await supabase
      .from('task_template_visible_companies' as any)
      .delete()
      .eq('task_template_id', templateId);
    await supabase
      .from('task_template_visible_departments' as any)
      .delete()
      .eq('task_template_id', templateId);
    
    if (companyIds.length > 0) {
      await supabase
        .from('task_template_visible_companies' as any)
        .insert(companyIds.map(companyId => ({
          task_template_id: templateId,
          company_id: companyId,
        })));
    }
    
    if (departmentIds.length > 0) {
      await supabase
        .from('task_template_visible_departments' as any)
        .insert(departmentIds.map(departmentId => ({
          task_template_id: templateId,
          department_id: departmentId,
        })));
    }
  }
}

export async function getTemplateVisibility(
  templateType: TemplateType,
  templateId: string
): Promise<VisibilityData> {
  let companyIds: string[] = [];
  let departmentIds: string[] = [];

  if (templateType === 'process') {
    const [companiesRes, departmentsRes] = await Promise.all([
      supabase
        .from('process_template_visible_companies' as any)
        .select('company_id')
        .eq('process_template_id', templateId),
      supabase
        .from('process_template_visible_departments' as any)
        .select('department_id')
        .eq('process_template_id', templateId),
    ]);
    
    companyIds = (companiesRes.data as any[] || []).map((r: any) => r.company_id);
    departmentIds = (departmentsRes.data as any[] || []).map((r: any) => r.department_id);
  } else if (templateType === 'sub_process') {
    const [companiesRes, departmentsRes] = await Promise.all([
      supabase
        .from('sub_process_template_visible_companies' as any)
        .select('company_id')
        .eq('sub_process_template_id', templateId),
      supabase
        .from('sub_process_template_visible_departments' as any)
        .select('department_id')
        .eq('sub_process_template_id', templateId),
    ]);
    
    companyIds = (companiesRes.data as any[] || []).map((r: any) => r.company_id);
    departmentIds = (departmentsRes.data as any[] || []).map((r: any) => r.department_id);
  } else if (templateType === 'task') {
    const [companiesRes, departmentsRes] = await Promise.all([
      supabase
        .from('task_template_visible_companies' as any)
        .select('company_id')
        .eq('task_template_id', templateId),
      supabase
        .from('task_template_visible_departments' as any)
        .select('department_id')
        .eq('task_template_id', templateId),
    ]);
    
    companyIds = (companiesRes.data as any[] || []).map((r: any) => r.company_id);
    departmentIds = (departmentsRes.data as any[] || []).map((r: any) => r.department_id);
  }

  return { companyIds, departmentIds };
}
