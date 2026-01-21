import { Task, TaskStatus, TaskPriority } from '@/types/task';

export interface Profile {
  id: string;
  display_name: string | null;
  manager_id: string | null;
}

export interface Department {
  id: string;
  name: string;
}

export interface SubProcessGroup {
  subProcessId: string;
  subProcessName: string;
  departmentId: string | null;
  departmentName: string | null;
  tasks: Task[];
  completedCount: number;
  totalCount: number;
  progressPercent: number;
  status: 'pending' | 'in-progress' | 'done';
}

export interface RequestDetailDialogProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
}

export const priorityConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string }> = {
  low: { label: 'Basse', variant: 'secondary', color: 'text-muted-foreground' },
  medium: { label: 'Moyenne', variant: 'outline', color: 'text-warning' },
  high: { label: 'Haute', variant: 'default', color: 'text-orange-500' },
  urgent: { label: 'Urgente', variant: 'destructive', color: 'text-destructive' },
};

export const statusConfig: Record<string, { label: string; color: string }> = {
  to_assign: { label: 'À affecter', color: 'text-orange-500' },
  todo: { label: 'À faire', color: 'text-muted-foreground' },
  'in-progress': { label: 'En cours', color: 'text-info' },
  done: { label: 'Terminé', color: 'text-success' },
  'pending-validation': { label: 'En validation', color: 'text-warning' },
  validated: { label: 'Validé', color: 'text-success' },
  refused: { label: 'Refusé', color: 'text-destructive' },
};
