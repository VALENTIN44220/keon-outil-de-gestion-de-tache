import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { ValidationNotificationBell } from '@/components/notifications/ValidationNotificationBell';
import { useNotifications } from '@/hooks/useNotifications';
import { useCommentNotifications } from '@/hooks/useCommentNotifications';
import { useInAppNotifications } from '@/hooks/useInAppNotifications';
import { usePendingValidationRequests } from '@/hooks/usePendingValidationRequests';
import { usePendingTaskValidations } from '@/hooks/usePendingTaskValidations';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
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
  const { profile: authProfile } = useAuth();
  const { getActiveProfile } = useSimulation();
  const profile = getActiveProfile() ?? authProfile;
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

  const { notifications, unreadCount, hasUrgent, dismissAll: dismissAllDeadlines } = useNotifications(tasksForDeadlineNotifs);
  const { commentNotifications, markAsRead: markCommentNotificationRead, markAllAsRead: markAllCommentRead } = useCommentNotifications();
  const {
    notifications: workflowInApp,
    unreadCount: workflowUnread,
    markAsRead: markWorkflowRead,
    deleteAll: deleteAllWorkflow,
  } = useInAppNotifications();

  const defaultOpenTask = async (taskId: string) => {
    // Modules IT / Logistique / Maintenance : vues métier dédiées (dispatch
    // avec dialog spécifique au module). Le reste — flux BE, RH, demandes
    // génériques et étapes — converge vers la page plein écran /demande/:taskId
    // (nouveau modèle unifié), qui sait afficher une demande comme une étape
    // et fonctionne pour tous les rôles. Cela évite l'empilement de dialogs
    // (les anciennes pages persistantes portalisaient leurs modales par-dessus).
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data } = await supabase
        .from('tasks')
        .select('module_code')
        .eq('id', taskId)
        .maybeSingle();
      const mc = (data as any)?.module_code as string | null;

      if (mc === 'cgi') {
        navigate('/it/comite-gi');
        return;
      }
      const moduleRoutes: Record<string, string> = {
        it: '/it/dispatch',
        logistique: '/logistique/dispatch',
        maintenance: '/maintenance/dispatch',
      };
      if (mc && moduleRoutes[mc]) {
        navigate(`${moduleRoutes[mc]}?openTask=${encodeURIComponent(taskId)}`);
        return;
      }
    } catch (e) {
      // Fallback ci-dessous
    }

    navigate(`/demande/${encodeURIComponent(taskId)}`);
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
          if (row.related_entity_type === 'supplier_waiting_approval') {
            if (row.type === 'supplier_promoted') {
              navigate('/suppliers');
            } else if (row.related_entity_id && ['supplier_rejection', 'supplier_review_requested', 'supplier_deleted'].includes(row.type ?? '')) {
              navigate(`/suppliers?myRequests=true&requestId=${encodeURIComponent(row.related_entity_id)}`);
            } else {
              navigate(`/suppliers?openWaiting=true`);
            }
            return;
          }
          if (row.related_entity_type === 'bug_report') {
            navigate(`/bugs?openBug=${encodeURIComponent(row.related_entity_id ?? '')}`);
            return;
          }
          if (!row.related_entity_id) return;
          if (row.related_entity_type === 'nc_declaration') {
            navigate(`/smq/${row.related_entity_id}`);
            return;
          }
          if (row.related_entity_type === 'task') {
            if (row.type === 'be_request_created') {
              navigate(`/be/dispatch?requestId=${encodeURIComponent(row.related_entity_id)}`);
              return;
            }
            defaultOpenTask(row.related_entity_id);
          }
        }}
        onClearDeadlines={dismissAllDeadlines}
        onClearComments={() => void markAllCommentRead()}
        onClearWorkflow={() => void deleteAllWorkflow()}
      />
    </div>
  );
}
