import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export function useTaskComments(taskId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [userProfileId, setUserProfileId] = useState<string | null>(null);

  // Fetch user profile id
  useEffect(() => {
    const fetchProfileId = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (data) {
        setUserProfileId(data.id);
      }
    };
    fetchProfileId();
  }, [user]);

  const fetchComments = useCallback(async () => {
    if (!taskId) {
      setComments([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .select(`
          id,
          task_id,
          author_id,
          content,
          created_at,
          updated_at,
          author:profiles!task_comments_author_id_fkey(id, display_name, avatar_url)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Flatten the author object
      const formattedComments = (data || []).map((comment: any) => ({
        ...comment,
        author: comment.author || { id: comment.author_id, display_name: null, avatar_url: null }
      }));

      setComments(formattedComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  // Fetch comments on mount and when taskId changes
  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!taskId) return;

    const channel = supabase
      .channel(`task_comments_${taskId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_comments',
          filter: `task_id=eq.${taskId}`,
        },
        () => {
          // Refetch on any change
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId, fetchComments]);

  const addComment = async (content: string) => {
    if (!taskId || !userProfileId || !content.trim()) return;

    setIsSending(true);
    try {
      const { error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          author_id: userProfileId,
          content: content.trim(),
        });

      if (error) throw error;

      // Realtime will update the list
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'envoyer le message',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('task_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      // Realtime will update the list
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le message',
        variant: 'destructive',
      });
    }
  };

  return {
    comments,
    isLoading,
    isSending,
    addComment,
    deleteComment,
    refetch: fetchComments,
    userProfileId,
  };
}
