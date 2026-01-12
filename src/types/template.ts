export interface ProcessTemplate {
  id: string;
  name: string;
  description: string | null;
  user_id: string;
  company: string | null;
  department: string | null;
  is_shared?: boolean;
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
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface SubProcessWithTasks extends SubProcessTemplate {
  task_templates: TaskTemplate[];
}

export interface ProcessWithSubProcesses extends ProcessTemplate {
  sub_processes: SubProcessWithTasks[];
}

// Legacy type for backward compatibility
export interface ProcessWithTasks extends ProcessTemplate {
  task_templates: TaskTemplate[];
}
