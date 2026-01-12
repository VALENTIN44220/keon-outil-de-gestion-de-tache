export type TemplateVisibility = 'private' | 'internal_department' | 'internal_company' | 'public';

export const VISIBILITY_LABELS: Record<TemplateVisibility, string> = {
  private: 'Privé',
  internal_department: 'Service',
  internal_company: 'Société',
  public: 'Public',
};

export const VISIBILITY_DESCRIPTIONS: Record<TemplateVisibility, string> = {
  private: 'Visible uniquement par vous et les administrateurs',
  internal_department: 'Visible par les membres de votre service',
  internal_company: 'Visible par les membres de votre société',
  public: 'Visible par tous les utilisateurs',
};

export interface ProcessTemplate {
  id: string;
  name: string;
  description: string | null;
  user_id: string;
  company: string | null;
  department: string | null;
  is_shared?: boolean;
  visibility_level: TemplateVisibility;
  creator_company_id: string | null;
  creator_department_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubProcessTemplate {
  id: string;
  process_template_id: string;
  name: string;
  description: string | null;
  assignment_type: 'manager' | 'user' | 'role';
  target_assignee_id: string | null;
  target_department_id: string | null;
  target_job_title_id: string | null;
  order_index: number;
  is_shared: boolean;
  visibility_level: TemplateVisibility;
  creator_company_id: string | null;
  creator_department_id: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface TaskTemplate {
  id: string;
  process_template_id: string | null;
  sub_process_template_id: string | null;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  default_duration_days: number;
  order_index: number;
  visibility_level: TemplateVisibility;
  creator_company_id: string | null;
  creator_department_id: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;

  /** UI helper (computed client-side) */
  can_manage?: boolean;
}

export interface SubProcessWithTasks extends SubProcessTemplate {
  task_templates: TaskTemplate[];

  /** UI helper (computed client-side) */
  can_manage?: boolean;
}

export interface ProcessWithSubProcesses extends ProcessTemplate {
  sub_processes: SubProcessWithTasks[];

  /** UI helper (computed client-side) */
  can_manage?: boolean;
}

// Legacy type for backward compatibility
export interface ProcessWithTasks extends ProcessTemplate {
  task_templates: TaskTemplate[];

  /** UI helper (computed client-side) */
  can_manage?: boolean;
}

