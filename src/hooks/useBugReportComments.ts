import { useState, useEffect, useCallback, useMemo, useId } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCurrentProfileId } from '@/hooks/useBugReports';
import type { BugReportComment } from '@/types/bugReport';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

/** Fil de commentaires d'un ticket (calque de useTaskComments). */
export function useBugReportComments(bugReportId: string | null) {
  const userProfileId = useCurrentProfileId();
  const { toast } = useToast();
  const [comments, setComments] = useState<BugReportComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const instanceId = useId();

  const fetchComments = useCallback(async () => {
    if (!bugReportId) { setComments([]); return; }
    setIsLoading(true);
    try {
      const { data, error } = await db()
        .from('bug_report_comments')
        .select('id, bug_report_id, author_id, content, created_at, updated_at, author:profiles!bug_report_comments_author_id_fkey(id, display_name, avatar_url)')
        .eq('bug_report_id', bugReportId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const formatted = (data || []).map((c: any) => ({
        ...c,
        author: c.author || { id: c.author_id, display_name: null, avatar_url: null },
      }));
      setComments(formatted as BugReportComment[]);
    } catch (e) {
      console.error('Error fetching bug comments:', e);
    } finally {
      setIsLoading(false);
    }
  }, [bugReportId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  useEffect(() => {
    if (!bugReportId) return;
    const channel = supabase
      .channel(`bug_report_comments_${bugReportId}:${instanceId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'bug_report_comments',
        filter: `bug_report_id=eq.${bugReportId}`,
      }, () => fetchComments())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [bugReportId, fetchComments, instanceId]);

  const addComment = async (content: string) => {
    if (!bugReportId || !userProfileId || !content.trim()) return;
    setIsSending(true);
    try {
      const { error } = await db().from('bug_report_comments').insert({
        bug_report_id: bugReportId,
        author_id: userProfileId,
        content: content.trim(),
      });
      if (error) throw error;
    } catch (e) {
      console.error('Error adding bug comment:', e);
      toast({ title: 'Erreur', description: "Impossible d'envoyer le message", variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      const { error } = await db().from('bug_report_comments').delete().eq('id', commentId);
      if (error) throw error;
    } catch (e) {
      console.error('Error deleting bug comment:', e);
      toast({ title: 'Erreur', description: 'Impossible de supprimer le message', variant: 'destructive' });
    }
  };

  return {
    comments, isLoading, isSending, addComment, deleteComment,
    refetch: fetchComments, userProfileId,
  };
}
