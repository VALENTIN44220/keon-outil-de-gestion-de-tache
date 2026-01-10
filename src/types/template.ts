export interface ProcessTemplate {
  id: string;
  name: string;
  description: string | null;
  user_id: string;
  company: string | null;
  department: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskTemplate {
  id: string;
  process_template_id: string | null;
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

export interface ProcessWithTasks extends ProcessTemplate {
  task_templates: TaskTemplate[];
}
