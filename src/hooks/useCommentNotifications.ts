import { useEffect, useState, useCallback, useId } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { chunkedInQuery } from '@/lib/chunkedInQuery';

export interface CommentNotification {
  id: string;
  taskId: string;
  taskTitle: string;
  authorName: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

export function useCommentNotifications() {
  const { profile: authProfile } = useAuth();
  const { getActiveProfile } = useSimulation();
  const profile = getActiveProfile() ?? authProfile;
  const [commentNotifications, setCommentNotifications] = useState<CommentNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Unique channel name per hook instance. With <PersistentRoutes> keeping every visited page
  // mounted, the Sidebar (which hosts this hook) is instantiated multiple times in parallel.
  // Supabase de-duplicates channels by name, so a fixed name causes the 2nd instance to try
  // .on('postgres_changes') on an already-subscribed channel → "cannot add callbacks after subscribe()".
  const instanceId = useId();

  const fetchRecentComments = useCallback(async () => {
    if (!profile?.id) return;

    try {
      // Fetch comments on tasks where the current user is involved (assignee, requester, or creator)
      // and the comment is NOT from the current user
      const { data: userTasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title')
        .or(`assignee_id.eq.${profile.id},requester_id.eq.${profile.id},user_id.eq.${profile.id}`);

      if (tasksError || !userTasks?.length) {
        setCommentNotifications([]);
        setIsLoading(false);
        return;
      }

      const taskIds = userTasks.map(t => t.id);
      const taskMap = new Map(userTasks.map(t => [t.id, t.title]));

      // Fetch recent comments (last 24 hours) on these tasks, excluding user's own comments
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      // Chunke pour éviter les URLs trop longues quand l'utilisateur a beaucoup
      // de tâches (au-delà de ~500 IDs, le filtre .in() dépasse la limite côté
      // CDN/proxy → 400). Chaque chunk applique le même filtre temps + auteur,
      // on ne ramène que les 20 plus récents par chunk, puis on consolide.
      const { data: chunkedComments, errors: commentsErrors } = await chunkedInQuery<{
        id: string;
        task_id: string;
        content: string;
        created_at: string;
        author: { id: string; display_name: string } | null;
      }>(
        taskIds,
        (chunk) =>
          supabase
            .from('task_comments')
            .select(`
              id,
              task_id,
              content,
              created_at,
              author:profiles!task_comments_author_id_fkey ( id, display_name )
            `)
            .in('task_id', chunk)
            .neq('author_id', profile.id)
            .gte('created_at', twentyFourHoursAgo)
            .order('created_at', { ascending: false })
            .limit(20) as any,
      );

      if (commentsErrors.length > 0) {
        console.error('Error fetching comment notifications:', commentsErrors[0]);
        setCommentNotifications([]);
        setIsLoading(false);
        return;
      }

      // Trie global + top 20 (chaque chunk a déjà ses propres 20, on consolide)
      const comments = chunkedComments
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 20);

      const notifications: CommentNotification[] = (comments || []).map(comment => ({
        id: comment.id,
        taskId: comment.task_id,
        taskTitle: taskMap.get(comment.task_id) || 'Demande',
        authorName: (comment.author as any)?.display_name || 'Utilisateur',
        message: comment.content.length > 60 ? comment.content.substring(0, 60) + '...' : comment.content,
        createdAt: comment.created_at,
        isRead: false,
      }));

      setCommentNotifications(notifications);
    } catch (error) {
      console.error('Error in fetchRecentComments:', error);
      setCommentNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.id]);

  // Initial fetch
  useEffect(() => {
    fetchRecentComments();
  }, [fetchRecentComments]);

  // Real-time subscription for new comments
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`comment-notifications:${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_comments',
        },
        async (payload) => {
          // Ignore own comments
          if ((payload.new as any).author_id === profile.id) return;

          // Check if the task belongs to the user
          const { data: task } = await supabase
            .from('tasks')
            .select('id, title, assignee_id, requester_id, user_id')
            .eq('id', (payload.new as any).task_id)
            .single();

          if (!task) return;

          // Check if user is involved in this task
          const isInvolved = [task.assignee_id, task.requester_id, task.user_id].includes(profile.id);
          if (!isInvolved) return;

          // Fetch author info
          const { data: author } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', (payload.new as any).author_id)
            .single();

          const newNotification: CommentNotification = {
            id: (payload.new as any).id,
            taskId: task.id,
            taskTitle: task.title,
            authorName: author?.display_name || 'Utilisateur',
            message: (payload.new as any).content.length > 60 
              ? (payload.new as any).content.substring(0, 60) + '...' 
              : (payload.new as any).content,
            createdAt: (payload.new as any).created_at,
            isRead: false,
          };

          setCommentNotifications(prev => [newNotification, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, instanceId]);

  const markAsRead = useCallback((notificationId: string) => {
    setCommentNotifications(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, isRead: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setCommentNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  }, []);

  const unreadCount = commentNotifications.filter(n => !n.isRead).length;

  return {
    commentNotifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refetch: fetchRecentComments,
  };
}
