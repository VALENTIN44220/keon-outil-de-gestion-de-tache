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
  category_id: string | null;
  subcategory_id: string | null;
  target_company_id: string | null;
  target_department_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ValidationLevelType = 'none' | 'manager' | 'requester' | 'free';

export const VALIDATION_TYPE_LABELS: Record<ValidationLevelType, string> = {
  none: 'Non',
  manager: 'Manager',
  requester: 'Demandeur',
  free: 'Libre',
};

export type AssignmentType = 'manager' | 'user' | 'role' | 'group';

export const ASSIGNMENT_TYPE_LABELS: Record<AssignmentType, string> = {
  manager: 'Par manager',
  user: 'Utilisateur spécifique',
  role: 'Par poste',
  group: 'Groupe de collaborateurs',
};

export interface SubProcessTemplate {
  id: string;
  process_template_id: string;
  name: string;
  description: string | null;
  assignment_type: AssignmentType;
  target_assignee_id: string | null;
  target_department_id: string | null;
  target_job_title_id: string | null;
  target_manager_id: string | null;
  target_group_id: string | null;
  order_index: number;
  is_shared: boolean;
  is_mandatory: boolean;
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
  
  // Validation fields
  validation_level_1: ValidationLevelType;
  validation_level_2: ValidationLevelType;
  validator_level_1_id: string | null;
  validator_level_2_id: string | null;

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

