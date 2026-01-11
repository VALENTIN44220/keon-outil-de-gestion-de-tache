export type TaskStatus = 'todo' | 'in-progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskType = 'task' | 'request';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  category: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  due_date: string | null;
  assignee_id: string | null;
  requester_id: string | null;
  reporter_id: string | null;
  target_department_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskStats {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  completionRate: number;
}

export interface AssignmentRule {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  target_department_id: string | null;
  target_assignee_id: string | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
