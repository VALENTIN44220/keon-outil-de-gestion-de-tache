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

  const { notifications, unreadCount, hasUrgent, dismissAll: dismissAllDeadlines } = useNotifications(tasksForDeadlineNotifs);
  const { commentNotifications, markAsRead: markCommentNotificationRead, markAllAsRead: markAllCommentRead } = useCommentNotifications();
  const {
    notifications: workflowInApp,
    unreadCount: workflowUnread,
    markAsRead: markWorkflowRead,
    deleteAll: deleteAllWorkflow,
  } = useInAppNotifications();

  // ID du processus Bureau d'Études — détection des tâches/demandes BE
  const BE_PROCESS_ID = 'bd75a3b0-c918-4b43-befe-739b83f7461a';

  const defaultOpenTask = async (taskId: string) => {
    const path = location.pathname;
    // On charge plusieurs colonnes pour pouvoir router correctement
    // selon la nature de la tâche (module IT/Logistique/Maintenance ou flux BE).
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data } = await supabase
        .from('tasks')
        .select('module_code, type, source_process_template_id, process_template_id, be_status, parent_request_id, requester_id')
        .eq('id', taskId)
        .maybeSingle();
      const t = (data as any) ?? {};
      const mc = t.module_code as string | null;

      // 1. Modules IT / Logistique / Maintenance via module_code
      const moduleRoutes: Record<string, string> = {
        it: '/it/dispatch',
        logistique: '/logistique/dispatch',
        maintenance: '/maintenance/dispatch',
      };
      if (mc && moduleRoutes[mc]) {
        navigate(`${moduleRoutes[mc]}?openTask=${encodeURIComponent(taskId)}`);
        return;
      }

      // 2. Flux BE : détecté par process_template_id, be_status, ou parent BE
      const isBE =
        t.source_process_template_id === BE_PROCESS_ID ||
        t.process_template_id === BE_PROCESS_ID ||
        Boolean(t.be_status);
      if (isBE) {
        // On route vers /  (Index) qui sait ouvrir n'importe quelle tâche
        // via ?openTask=... — fonctionne pour TOUS les rôles (assigné,
        // demandeur, validateur, admin). /be/dispatch n'est accessible
        // qu'au manager BE, donc impraticable comme cible générique.
        navigate(`/?openTask=${encodeURIComponent(taskId)}`);
        return;
      }
    } catch (e) {
      // Fallback ci-dessous
    }

    // 3. Si on est déjà sur /requests, on reste dessus
    if (path === '/requests' || path.startsWith('/requests/')) {
      navigate(`/requests?openTask=${encodeURIComponent(taskId)}`);
      return;
    }

    // 4. Fallback générique : / (Index) qui sait ouvrir une tâche via
    //    ?openTask=... — évite l'écran blanc à la racine.
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
          if (!row.related_entity_id) return;
          // Routing selon le type d'entité liée
          if (row.related_entity_type === 'nc_declaration') {
            navigate(`/smq/${row.related_entity_id}`);
            return;
          }
          if (row.related_entity_type === 'task') {
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
