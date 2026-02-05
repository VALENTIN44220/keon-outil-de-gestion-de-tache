import { useState, useEffect, useCallback } from 'react';
import { useChat } from '@/hooks/useChat';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { Sidebar } from '@/components/layout/Sidebar';
import {
  ConversationList,
  MessageArea,
  MessageComposer,
  ChatHeader,
  NewChatDialog,
  NewGroupDialog,
} from '@/components/chat';
import { cn } from '@/lib/utils';
import type { ConversationWithDetails } from '@/types/chat';

export default function Chat() {
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const {
    conversations,
    loading: conversationsLoading,
    totalUnread,
    createDM,
    createGroup,
    markAsRead,
    refreshConversations,
  } = useChat();

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showConversationList, setShowConversationList] = useState(true);

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  const {
    messages,
    loading: messagesLoading,
    hasMore,
    sending,
    fetchMore,
    sendMessage,
    editMessage,
    deleteMessage,
    getAttachmentUrl,
  } = useChatMessages(selectedConversationId);

  // Mark as read when conversation is selected
  useEffect(() => {
    if (selectedConversationId && selectedConversation?.unread_count) {
      markAsRead(selectedConversationId);
    }
  }, [selectedConversationId, selectedConversation?.unread_count, markAsRead]);

  // Handle conversation selection
  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id);
    if (isMobile) {
      setShowConversationList(false);
    }
  };

  // Handle back to list (mobile)
  const handleBack = () => {
    setShowConversationList(true);
    if (isMobile) {
      setSelectedConversationId(null);
    }
  };

  // Handle new DM
  const handleNewDM = async (userId: string) => {
    const conversationId = await createDM(userId);
    if (conversationId) {
      setSelectedConversationId(conversationId);
      if (isMobile) {
        setShowConversationList(false);
      }
    }
  };

  // Handle new group
  const handleNewGroup = async (title: string, memberIds: string[]) => {
    const conversationId = await createGroup({ title, member_ids: memberIds });
    if (conversationId) {
      setSelectedConversationId(conversationId);
      if (isMobile) {
        setShowConversationList(false);
      }
    }
  };

  // Handle send message
  const handleSendMessage = async (content: string, attachments: File[]) => {
    if (!selectedConversationId) return false;
    return sendMessage({
      conversation_id: selectedConversationId,
      content,
      attachments,
    });
  };

  // Handle toggle mute
  const handleToggleMute = async () => {
    if (!selectedConversationId || !profile?.id) return;
    
    const currentMembership = selectedConversation?.members.find(
      m => m.user_id === profile.id
    );
    
    if (!currentMembership) return;

    await supabase
      .from('chat_members')
      .update({ muted: !currentMembership.muted })
      .eq('conversation_id', selectedConversationId)
      .eq('user_id', profile.id);

    refreshConversations();
  };

  // Handle leave group
  const handleLeaveGroup = async () => {
    if (!selectedConversationId || !profile?.id) return;

    await supabase
      .from('chat_members')
      .delete()
      .eq('conversation_id', selectedConversationId)
      .eq('user_id', profile.id);

    setSelectedConversationId(null);
    setShowConversationList(true);
    refreshConversations();
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar activeView="chat" onViewChange={() => {}} />
      
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 flex overflow-hidden">
          {/* Conversation list */}
          <div className={cn(
            "border-r bg-background flex-shrink-0 transition-all",
            isMobile 
              ? (showConversationList ? "w-full" : "w-0 overflow-hidden")
              : "w-80"
          )}>
            <ConversationList
              conversations={conversations}
              loading={conversationsLoading}
              selectedId={selectedConversationId}
              onSelect={handleSelectConversation}
              onNewChat={() => setShowNewChat(true)}
              onNewGroup={() => setShowNewGroup(true)}
            />
          </div>

          {/* Chat area */}
          <div className={cn(
            "flex-1 flex flex-col min-w-0",
            isMobile && showConversationList && "hidden"
          )}>
            {selectedConversation ? (
              <>
                <ChatHeader
                  conversation={selectedConversation}
                  onBack={handleBack}
                  onToggleMute={handleToggleMute}
                  onLeaveGroup={selectedConversation.type === 'group' ? handleLeaveGroup : undefined}
                  isMobile={isMobile}
                />
                
                <MessageArea
                  messages={messages}
                  loading={messagesLoading}
                  hasMore={hasMore}
                  onLoadMore={fetchMore}
                  onDeleteMessage={deleteMessage}
                  onEditMessage={editMessage}
                  getAttachmentUrl={getAttachmentUrl}
                />
                
                <MessageComposer
                  onSend={handleSendMessage}
                  sending={sending}
                />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <p className="text-lg mb-2">Sélectionnez une conversation</p>
                  <p className="text-sm">
                    Ou démarrez une nouvelle conversation en cliquant sur l'icône message
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Dialogs */}
      <NewChatDialog
        open={showNewChat}
        onOpenChange={setShowNewChat}
        onSelectUser={handleNewDM}
      />
      
      <NewGroupDialog
        open={showNewGroup}
        onOpenChange={setShowNewGroup}
        onCreateGroup={handleNewGroup}
      />
    </div>
  );
}
