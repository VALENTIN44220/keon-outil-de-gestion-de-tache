 import { useState, useEffect, useCallback } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 import { toast } from 'sonner';
 
 export interface ProjectComment {
   id: string;
   project_id: string;
   user_id: string;
   content: string;
   created_at: string;
   updated_at: string;
   user?: {
     id: string;
     display_name: string | null;
     avatar_url: string | null;
   };
 }
 
 export function useProjectComments(projectId: string | null) {
   const { profile } = useAuth();
   const [comments, setComments] = useState<ProjectComment[]>([]);
   const [isLoading, setIsLoading] = useState(false);
   const [isSending, setIsSending] = useState(false);
 
   const fetchComments = useCallback(async () => {
     if (!projectId) return;
 
     setIsLoading(true);
     try {
       const { data, error } = await supabase
         .from('be_project_comments')
         .select(`
           *,
           user:profiles!be_project_comments_user_id_fkey(id, display_name, avatar_url)
         `)
         .eq('project_id', projectId)
         .order('created_at', { ascending: true });
 
       if (error) throw error;
       setComments(data || []);
     } catch (error) {
       console.error('Error fetching project comments:', error);
     } finally {
       setIsLoading(false);
     }
   }, [projectId]);
 
   // Subscribe to realtime updates
   useEffect(() => {
     if (!projectId) return;
 
     fetchComments();
 
     const channel = supabase
       .channel(`project-comments-${projectId}`)
       .on(
         'postgres_changes',
         {
           event: '*',
           schema: 'public',
           table: 'be_project_comments',
           filter: `project_id=eq.${projectId}`,
         },
         () => {
           fetchComments();
         }
       )
       .subscribe();
 
     return () => {
       supabase.removeChannel(channel);
     };
   }, [projectId, fetchComments]);
 
   const addComment = async (content: string) => {
     if (!projectId || !profile?.id || !content.trim()) return false;
 
     setIsSending(true);
     try {
       const { error } = await supabase.from('be_project_comments').insert({
         project_id: projectId,
         user_id: profile.id,
         content: content.trim(),
       });
 
       if (error) throw error;
       return true;
     } catch (error) {
       console.error('Error adding comment:', error);
       toast.error("Erreur lors de l'envoi du commentaire");
       return false;
     } finally {
       setIsSending(false);
     }
   };
 
   const deleteComment = async (commentId: string) => {
     try {
       const { error } = await supabase
         .from('be_project_comments')
         .delete()
         .eq('id', commentId);
 
       if (error) throw error;
       toast.success('Commentaire supprimé');
       return true;
     } catch (error) {
       console.error('Error deleting comment:', error);
       toast.error('Erreur lors de la suppression');
       return false;
     }
   };
 
   return {
     comments,
     isLoading,
     isSending,
     addComment,
     deleteComment,
     refetch: fetchComments,
   };
 }