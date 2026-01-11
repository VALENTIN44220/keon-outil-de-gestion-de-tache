import { useState, useCallback, useEffect } from 'react';
import { TaskAttachment } from '@/types/task';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export function useTaskAttachments(taskId: string | null) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAttachments = useCallback(async () => {
    if (!taskId) return;

    setIsLoading(true);
    const { data, error } = await supabase
      .from('task_attachments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching attachments:', error);
    } else {
      setAttachments((data || []) as TaskAttachment[]);
    }
    setIsLoading(false);
  }, [taskId]);

  useEffect(() => {
    if (taskId) {
      fetchAttachments();
    }
  }, [taskId, fetchAttachments]);

  const addAttachment = async (name: string, url: string, type: 'link' | 'file') => {
    if (!taskId || !profile) return;

    const { data, error } = await supabase
      .from('task_attachments')
      .insert({
        task_id: taskId,
        name,
        url,
        type,
        uploaded_by: profile.id,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible d\'ajouter le lien',
        variant: 'destructive',
      });
    } else {
      setAttachments(prev => [data as TaskAttachment, ...prev]);
      toast({
        title: 'Lien ajouté',
        description: 'Le lien a été ajouté avec succès',
      });
    }
  };

  const deleteAttachment = async (attachmentId: string) => {
    const { error } = await supabase
      .from('task_attachments')
      .delete()
      .eq('id', attachmentId);

    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le lien',
        variant: 'destructive',
      });
    } else {
      setAttachments(prev => prev.filter(a => a.id !== attachmentId));
    }
  };

  return {
    attachments,
    isLoading,
    addAttachment,
    deleteAttachment,
    refetch: fetchAttachments,
  };
}
