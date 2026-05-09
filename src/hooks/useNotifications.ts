import { useCallback, useMemo, useState, useEffect } from 'react';
import { Task } from '@/types/task';
import { differenceInDays, differenceInHours, parseISO, isBefore, startOfDay } from 'date-fns';

const DISMISSED_KEY = 'deadline-notifs-dismissed-ids';

export interface TaskNotification {
  id: string;
  taskId: string;
  taskTitle: string;
  type: 'overdue' | 'due-today' | 'due-soon';
  message: string;
  priority: 'high' | 'medium' | 'low';
  dueDate: string;
}

export function useNotifications(tasks: Task[]) {
  // Notifs ecartees manuellement (cle = id de notification, persistance localStorage)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const raw = window.localStorage.getItem(DISMISSED_KEY);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch { return new Set(); }
  });

  useEffect(() => {
    try { window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(dismissedIds))); } catch { /* ignore */ }
  }, [dismissedIds]);

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
    const sorted = result.sort((a, b) => {
      const priorityOrder = { overdue: 0, 'due-today': 1, 'due-soon': 2 };
      return priorityOrder[a.type] - priorityOrder[b.type];
    });
    // Filtre les notifs ecartees manuellement
    return sorted.filter(n => !dismissedIds.has(n.id));
  }, [tasks, dismissedIds]);

  const unreadCount = notifications.length;
  const hasUrgent = notifications.some(n => n.type === 'overdue' || n.type === 'due-today');

  /** Ecartement total : on memorise tous les ids actuels comme dismissed. */
  const dismissAll = useCallback(() => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      for (const n of notifications) next.add(n.id);
      return next;
    });
  }, [notifications]);

  return {
    notifications,
    unreadCount,
    hasUrgent,
    dismissAll,
  };
}
