import { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { ValidationNotificationBell } from '@/components/notifications/ValidationNotificationBell';
import { useNotifications } from '@/hooks/useNotifications';
import { useCommentNotifications } from '@/hooks/useCommentNotifications';
import { useInAppNotifications } from '@/hooks/useInAppNotifications';
import { usePendingValidationRequests } from '@/hooks/usePendingValidationRequests';
import { usePendingTaskValidations } from '@/hooks/usePendingTaskValidations';
import { useAuth } from '@/contexts/AuthContext';
import { useDeadlineTasksOverride } from '@/contexts/DeadlineTasksOverrideContext';
import { supabase } from '@/integrations/supabase/client';
import type { Task } from '@/types/task';
import { cn } from '@/lib/utils';

interface AppNotificationClusterProps {
  /** When true (sidebar repliée), stack icons vertically. */
  collapsed?: boolean;
  className?: string;
}

export function AppNotificationCluster({ collapsed, className }: AppNotificationClusterProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const deadlineOverride = useDeadlineTasksOverride();

  const { requests: pendingRequestValidations } = usePendingValidationRequests();
  const { tasks: pendingTaskValidations } = usePendingTaskValidations();

  const mergedValidations = useMemo(() => {
    const merged = [...pendingRequestValidations, ...pendingTaskValidations] as Task[];
    merged.sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
    return merged;
  }, [pendingRequestValidations, pendingTaskValidations]);

  const totalValidationCount = mergedValidations.length;

  const { data: defaultDeadlineTasks = [] } = useQuery({
    queryKey: ['sidebar-deadline-tasks', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status, due_date, priority, type')
        .not('due_date', 'is', null)
        .or(`assignee_id.eq.${profile.id},requester_id.eq.${profile.id},user_id.eq.${profile.id}`);
      if (error) throw error;
      return (data || []) as Task[];
    },
    enabled: !!profile?.id,
    staleTime: 60 * 1000,
  });

  const tasksForDeadlineNotifs = deadlineOverride !== undefined ? deadlineOverride : defaultDeadlineTasks;

  const { notifications, unreadCount, hasUrgent } = useNotifications(tasksForDeadlineNotifs);
  const { commentNotifications, markAsRead: markCommentNotificationRead } = useCommentNotifications();
  const {
    notifications: workflowInApp,
    unreadCount: workflowUnread,
    markAsRead: markWorkflowRead,
  } = useInAppNotifications();

  const defaultOpenTask = (taskId: string) => {
    const path = location.pathname;
    if (path === '/requests' || path.startsWith('/requests/')) {
      navigate(`/requests?openTask=${encodeURIComponent(taskId)}`);
      return;
    }
    navigate(`/?openTask=${encodeURIComponent(taskId)}`);
  };

  return (
    <div
      className={cn(
        'flex items-center gap-1',
        collapsed ? 'flex-col justify-center' : 'flex-row justify-center flex-wrap',
        className
      )}
    >
      <ValidationNotificationBell
        pendingValidations={mergedValidations}
        count={totalValidationCount}
        onValidationClick={(taskId) => {
          defaultOpenTask(taskId);
        }}
      />
      <NotificationBell
        notifications={notifications}
        commentNotifications={commentNotifications}
        workflowInAppNotifications={workflowInApp}
        workflowInAppUnreadCount={workflowUnread}
        unreadCount={unreadCount}
        hasUrgent={hasUrgent}
        onNotificationClick={defaultOpenTask}
        onCommentNotificationClick={(taskId, notificationId) => {
          markCommentNotificationRead(notificationId);
          defaultOpenTask(taskId);
        }}
        onWorkflowInAppClick={(row) => {
          void markWorkflowRead(row.id);
          if (row.related_entity_type === 'task' && row.related_entity_id) {
            defaultOpenTask(row.related_entity_id);
          }
        }}
      />
    </div>
  );
}
