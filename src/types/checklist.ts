export interface ChecklistItem {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface TaskWithProgress {
  taskId: string;
  totalItems: number;
  completedItems: number;
  progress: number;
}
