import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { ChatMessage, SendMessageParams } from '@/types/chat';
import { useToast } from '@/hooks/use-toast';

const PAGE_SIZE = 30;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export function useChatMessages(conversationId: string | null) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sending, setSending] = useState(false);
  const cursorRef = useRef<string | null>(null);

  // Fetch messages with pagination
  const fetchMessages = useCallback(async (loadMore = false) => {
    if (!conversationId) return;

    setLoading(true);
    try {
      let query = supabase
        .from('chat_messages')
        .select(`
          *,
          sender:profiles!chat_messages_sender_id_fkey (
            id,
            display_name,
            avatar_url
          ),
          chat_attachments (
            id,
            message_id,
            conversation_id,
            uploader_id,
            storage_bucket,
            storage_path,
            file_name,
            mime_type,
            size_bytes,
            created_at
          )
        `)
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (loadMore && cursorRef.current) {
        query = query.lt('created_at', cursorRef.current);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedMessages: ChatMessage[] = (data || []).map(msg => ({
        ...msg,
        message_type: msg.message_type as 'text' | 'file' | 'system',
        attachments: msg.chat_attachments || [],
      })).reverse();

      if (loadMore) {
        setMessages(prev => [...formattedMessages, ...prev]);
      } else {
        setMessages(formattedMessages);
      }

      if (formattedMessages.length > 0) {
        cursorRef.current = formattedMessages[0].created_at;
      }
      
      setHasMore((data?.length || 0) === PAGE_SIZE);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les messages',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [conversationId, toast]);

  // Send message
  const sendMessage = useCallback(async ({ 
    conversation_id, 
    content, 
    message_type = 'text',
    attachments = [],
    reply_to_message_id 
  }: SendMessageParams): Promise<boolean> => {
    if (!profile?.id) return false;
    
    // Validate at least content or attachments
    if (!content?.trim() && attachments.length === 0) return false;

    setSending(true);
    try {
      // Determine message type
      const finalType = attachments.length > 0 && !content?.trim() ? 'file' : message_type;

      // Create message
      const { data: msgData, error: msgError } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id,
          sender_id: profile.id,
          content: content?.trim() || null,
          message_type: finalType,
          reply_to_message_id,
        })
        .select()
        .single();

      if (msgError) throw msgError;

      // Upload attachments if any
      if (attachments.length > 0) {
        for (const file of attachments) {
          // Validate file size
          if (file.size > MAX_FILE_SIZE) {
            toast({
              title: 'Fichier trop volumineux',
              description: `${file.name} dépasse la limite de 25MB`,
              variant: 'destructive',
            });
            continue;
          }

          // Generate unique path
          const now = new Date();
          const path = `${conversation_id}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}_${file.name}`;

          // Upload to storage
          const { error: uploadError } = await supabase.storage
            .from('chat-attachments')
            .upload(path, file);

          if (uploadError) {
            console.error('Upload error:', uploadError);
            toast({
              title: 'Erreur upload',
              description: `Impossible d'envoyer ${file.name}`,
              variant: 'destructive',
            });
            continue;
          }

          // Create attachment record
          await supabase.from('chat_attachments').insert({
            message_id: msgData.id,
            conversation_id,
            uploader_id: profile.id,
            storage_bucket: 'chat-attachments',
            storage_path: path,
            file_name: file.name,
            mime_type: file.type || 'application/octet-stream',
            size_bytes: file.size,
          });
        }
      }

      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Erreur',
        description: "Impossible d'envoyer le message",
        variant: 'destructive',
      });
      return false;
    } finally {
      setSending(false);
    }
  }, [profile?.id, toast]);

  // Edit message
  const editMessage = useCallback(async (messageId: string, newContent: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({ 
          content: newContent, 
          edited_at: new Date().toISOString() 
        })
        .eq('id', messageId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error editing message:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de modifier le message',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  // Delete message (soft delete)
  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', messageId);

      if (error) throw error;
      
      setMessages(prev => prev.filter(m => m.id !== messageId));
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le message',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  // Get attachment URL
  const getAttachmentUrl = useCallback(async (path: string): Promise<string | null> => {
    try {
      const { data } = await supabase.storage
        .from('chat-attachments')
        .createSignedUrl(path, 3600); // 1 hour

      return data?.signedUrl || null;
    } catch (error) {
      console.error('Error getting attachment URL:', error);
      return null;
    }
  }, []);

  // Initial fetch and reset on conversation change
  useEffect(() => {
    if (conversationId) {
      cursorRef.current = null;
      setMessages([]);
      setHasMore(true);
      fetchMessages();
    }
  }, [conversationId, fetchMessages]);

  // Realtime subscription for this conversation
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat-messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          // Fetch the complete message with sender info
          const { data } = await supabase
            .from('chat_messages')
            .select(`
              *,
              sender:profiles!chat_messages_sender_id_fkey (
                id,
                display_name,
                avatar_url
              ),
              chat_attachments (*)
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) {
            const newMessage: ChatMessage = {
              ...data,
              message_type: data.message_type as 'text' | 'file' | 'system',
              attachments: data.chat_attachments || [],
            };
            setMessages(prev => [...prev, newMessage]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as Record<string, unknown>;
          if (updated.deleted_at) {
            setMessages(prev => prev.filter(m => m.id !== updated.id));
          } else {
            setMessages(prev => 
              prev.map(m => m.id === updated.id ? { 
                ...m, 
                content: updated.content as string | null,
                edited_at: updated.edited_at as string | null,
              } : m)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  return {
    messages,
    loading,
    hasMore,
    sending,
    fetchMore: () => fetchMessages(true),
    sendMessage,
    editMessage,
    deleteMessage,
    getAttachmentUrl,
  };
}
