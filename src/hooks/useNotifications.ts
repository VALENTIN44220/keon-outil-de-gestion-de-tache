import { useMemo } from 'react';
import { Task } from '@/types/task';
import { differenceInDays, differenceInHours, parseISO, isAfter, isBefore, startOfDay } from 'date-fns';

export interface TaskNotification {
  id: string;
  taskId: string;
  taskTitle: string;
  type: 'overdue' | 'due-today' | 'due-soon' | 'new-comment';
  message: string;
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
  authorName?: string;
  createdAt?: string;
}

export function useNotifications(tasks: Task[]) {
  const notifications = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const result: TaskNotification[] = [];

    tasks.forEach((task) => {
      // Skip completed tasks
      if (task.status === 'done' || !task.due_date) return;

      const dueDate = parseISO(task.due_date);
      const dueDateStart = startOfDay(dueDate);
      const daysUntilDue = differenceInDays(dueDateStart, today);
      const hoursUntilDue = differenceInHours(dueDate, now);

      // Overdue tasks
      if (isBefore(dueDateStart, today)) {
        const daysOverdue = Math.abs(daysUntilDue);
        result.push({
          id: `overdue-${task.id}`,
          taskId: task.id,
          taskTitle: task.title,
          type: 'overdue',
          message: daysOverdue === 1 
            ? 'En retard depuis hier' 
            : `En retard de ${daysOverdue} jours`,
          priority: 'high',
          dueDate: task.due_date,
        });
      }
      // Due today
      else if (daysUntilDue === 0) {
        result.push({
          id: `due-today-${task.id}`,
          taskId: task.id,
          taskTitle: task.title,
          type: 'due-today',
          message: hoursUntilDue <= 0 
            ? "Échéance passée aujourd'hui" 
            : `Échéance dans ${hoursUntilDue}h`,
          priority: 'high',
          dueDate: task.due_date,
        });
      }
      // Due within 3 days
      else if (daysUntilDue <= 3) {
        result.push({
          id: `due-soon-${task.id}`,
          taskId: task.id,
          taskTitle: task.title,
          type: 'due-soon',
          message: daysUntilDue === 1 
            ? 'Échéance demain' 
            : `Échéance dans ${daysUntilDue} jours`,
          priority: daysUntilDue === 1 ? 'medium' : 'low',
          dueDate: task.due_date,
        });
      }
    });

    // Sort by priority (overdue first, then due-today, then due-soon)
    return result.sort((a, b) => {
      const priorityOrder = { overdue: 0, 'due-today': 1, 'due-soon': 2 };
      return priorityOrder[a.type] - priorityOrder[b.type];
    });
  }, [tasks]);

  const unreadCount = notifications.length;
  const hasUrgent = notifications.some(n => n.type === 'overdue' || n.type === 'due-today');

  return {
    notifications,
    unreadCount,
    hasUrgent,
  };
}
