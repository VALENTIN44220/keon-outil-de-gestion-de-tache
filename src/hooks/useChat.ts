import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { 
  ChatConversation, 
  ChatMember, 
  ChatMessage, 
  ChatAttachment,
  ConversationWithDetails,
  SendMessageParams,
  CreateGroupParams 
} from '@/types/chat';
import { useToast } from '@/hooks/use-toast';

export function useChat() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalUnread, setTotalUnread] = useState(0);

  // Fetch all conversations for current user
  const fetchConversations = useCallback(async () => {
    if (!profile?.id) return;

    try {
      // Get conversations where user is a member
      const { data: memberData, error: memberError } = await supabase
        .from('chat_members')
        .select('conversation_id')
        .eq('user_id', profile.id);

      if (memberError) throw memberError;
      
      const conversationIds = memberData?.map(m => m.conversation_id) || [];
      
      if (conversationIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Fetch conversations with members
      const { data: convData, error: convError } = await supabase
        .from('chat_conversations')
        .select(`
          *,
          chat_members (
            id,
            conversation_id,
            user_id,
            role,
            joined_at,
            last_read_at,
            muted,
            profile:profiles!chat_members_user_id_fkey (
              id,
              display_name,
              avatar_url,
              job_title
            )
          )
        `)
        .in('id', conversationIds)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (convError) throw convError;

      // Calculate unread counts
      const conversationsWithUnread: ConversationWithDetails[] = await Promise.all(
        (convData || []).map(async (conv) => {
          const myMembership = conv.chat_members?.find(
            (m: { user_id: string }) => m.user_id === profile.id
          );
          
          let unreadCount = 0;
          if (myMembership) {
            const { count } = await supabase
              .from('chat_messages')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', conv.id)
              .neq('sender_id', profile.id)
              .gt('created_at', myMembership.last_read_at)
              .is('deleted_at', null);
            
            unreadCount = count || 0;
          }

          return {
            ...conv,
            members: (conv.chat_members || []).map((m: Record<string, unknown>) => ({
              ...m,
              role: m.role as 'owner' | 'admin' | 'member',
            })) as ChatMember[],
            unread_count: unreadCount,
          } as ConversationWithDetails;
        })
      );

      setConversations(conversationsWithUnread);
      
      // Calculate total unread
      const total = conversationsWithUnread.reduce((sum, c) => sum + c.unread_count, 0);
      setTotalUnread(total);
      
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les conversations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.id, toast]);

  // Create or get DM conversation
  const createDM = useCallback(async (otherUserId: string): Promise<string | null> => {
    if (!profile?.id) return null;

    try {
      const { data, error } = await supabase
        .rpc('find_or_create_dm', {
          _user_a: profile.id,
          _user_b: otherUserId,
        });

      if (error) throw error;
      
      await fetchConversations();
      return data as string;
    } catch (error) {
      console.error('Error creating DM:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de créer la conversation',
        variant: 'destructive',
      });
      return null;
    }
  }, [profile?.id, fetchConversations, toast]);

  // Create group conversation
  const createGroup = useCallback(async ({ title, member_ids }: CreateGroupParams): Promise<string | null> => {
    if (!profile?.id) return null;

    try {
      const { data, error } = await supabase
        .rpc('create_group_conversation', {
          _title: title,
          _member_ids: member_ids,
          _created_by: profile.id,
        });

      if (error) throw error;
      
      await fetchConversations();
      return data as string;
    } catch (error) {
      console.error('Error creating group:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de créer le groupe',
        variant: 'destructive',
      });
      return null;
    }
  }, [profile?.id, fetchConversations, toast]);

  // Mark conversation as read
  const markAsRead = useCallback(async (conversationId: string) => {
    if (!profile?.id) return;

    try {
      const { error } = await supabase
        .from('chat_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', profile.id);

      if (error) throw error;

      // Update local state
      setConversations(prev => 
        prev.map(c => 
          c.id === conversationId 
            ? { ...c, unread_count: 0 }
            : c
        )
      );
      
      // Recalculate total
      setTotalUnread(prev => {
        const conv = conversations.find(c => c.id === conversationId);
        return Math.max(0, prev - (conv?.unread_count || 0));
      });
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }, [profile?.id, conversations]);

  // Initial fetch
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel('chat-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        () => {
          // Refresh conversations when new message arrives
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_members',
        },
        () => {
          // Refresh when membership changes
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, fetchConversations]);

  return {
    conversations,
    loading,
    totalUnread,
    createDM,
    createGroup,
    markAsRead,
    refreshConversations: fetchConversations,
  };
}
