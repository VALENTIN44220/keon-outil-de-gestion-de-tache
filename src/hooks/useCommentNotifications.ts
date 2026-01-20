import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

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
  const { profile } = useAuth();
  const [commentNotifications, setCommentNotifications] = useState<CommentNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      
      const { data: comments, error: commentsError } = await supabase
        .from('task_comments')
        .select(`
          id,
          task_id,
          content,
          created_at,
          author:profiles!task_comments_author_id_fkey (
            id,
            display_name
          )
        `)
        .in('task_id', taskIds)
        .neq('author_id', profile.id)
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false })
        .limit(20);

      if (commentsError) {
        console.error('Error fetching comment notifications:', commentsError);
        setCommentNotifications([]);
        setIsLoading(false);
        return;
      }

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
      .channel('comment-notifications')
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
  }, [profile?.id]);

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
