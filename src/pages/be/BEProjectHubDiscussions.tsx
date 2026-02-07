import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { BEProjectHubLayout } from '@/components/be/BEProjectHubLayout';
import { 
  useBEProjectByCode, 
  useBEProjectTasks,
  useBEProjectConversations,
  ProjectConversation
} from '@/hooks/useBEProjectHub';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageArea, MessageComposer } from '@/components/chat';
import { Search, MessageSquare, FileText, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function BEProjectHubDiscussions() {
  const { code } = useParams<{ code: string }>();
  const { profile } = useAuth();
  const initRef = useRef(false);
  
  const { data: project, isLoading: projectLoading } = useBEProjectByCode(code);
  const { data: tasks = [], isLoading: tasksLoading } = useBEProjectTasks(project?.id);
  
  const taskIds = useMemo(() => tasks.map(t => t.id), [tasks]);
  
  const { 
    data: conversations = [], 
    isLoading: convsLoading,
    ensureProjectConversation,
    refetch: refetchConversations
  } = useBEProjectConversations(project?.id, taskIds);

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Ensure project conversation exists on mount
  useEffect(() => {
    if (!project?.id || !profile?.id || initRef.current) return;
    
    initRef.current = true;
    
    const init = async () => {
      const convId = await ensureProjectConversation();
      if (convId && !selectedConversationId) {
        setSelectedConversationId(convId);
        refetchConversations();
      }
    };
    
    init();
  }, [project?.id, profile?.id, ensureProjectConversation, selectedConversationId, refetchConversations]);

  // Auto-select first conversation if none selected
  useEffect(() => {
    if (!selectedConversationId && conversations.length > 0) {
      const projectConv = conversations.find(c => c.scope_type === 'BE_PROJECT');
      if (projectConv) {
        setSelectedConversationId(projectConv.id);
      }
    }
  }, [conversations, selectedConversationId]);

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

  // Filter conversations
  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;
    return conversations.filter(c => 
      c.entity_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [conversations, searchQuery]);

  // Separate project conv from task convs
  const projectConversation = filteredConversations.find(c => c.scope_type === 'BE_PROJECT');
  const taskConversations = filteredConversations.filter(c => c.scope_type === 'TASK');

  const handleSendMessage = async (content: string, attachments: File[]) => {
    if (!selectedConversationId) return false;
    return sendMessage({
      conversation_id: selectedConversationId,
      content,
      attachments,
    });
  };

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  if (projectLoading || tasksLoading) {
    return (
      <BEProjectHubLayout>
        <div className="flex gap-4 h-[calc(100vh-200px)]">
          <Skeleton className="w-80 h-full" />
          <Skeleton className="flex-1 h-full" />
        </div>
      </BEProjectHubLayout>
    );
  }

  return (
    <BEProjectHubLayout>
      <div className="flex gap-4 h-[calc(100vh-200px)]">
        {/* Sidebar - Conversations List */}
        <Card className="w-80 flex-shrink-0 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              Discussions
            </CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1">
                {/* Project Conversation */}
                {projectConversation && (
                  <Button
                    variant={selectedConversationId === projectConversation.id ? 'secondary' : 'ghost'}
                    className="w-full justify-start h-auto py-3"
                    onClick={() => setSelectedConversationId(projectConversation.id)}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">Général (Projet)</span>
                          {projectConversation.unread_count > 0 && (
                            <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                              {projectConversation.unread_count}
                            </Badge>
                          )}
                        </div>
                        {projectConversation.last_message_preview && (
                          <p className="text-xs text-muted-foreground truncate">
                            {projectConversation.last_message_preview}
                          </p>
                        )}
                      </div>
                    </div>
                  </Button>
                )}

                {/* Task Conversations */}
                {taskConversations.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs font-medium text-muted-foreground px-3 py-1">
                      Tâches ({taskConversations.length})
                    </p>
                    {taskConversations.map((conv) => (
                      <Button
                        key={conv.id}
                        variant={selectedConversationId === conv.id ? 'secondary' : 'ghost'}
                        className="w-full justify-start h-auto py-2"
                        onClick={() => setSelectedConversationId(conv.id)}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 text-left min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm truncate">{conv.entity_name}</span>
                              {conv.unread_count > 0 && (
                                <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                                  {conv.unread_count}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                )}

                {filteredConversations.length === 0 && !convsLoading && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Aucune discussion trouvée
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Main Chat Area */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          {selectedConversation ? (
            <>
              <CardHeader className="border-b pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  {selectedConversation.scope_type === 'BE_PROJECT' ? (
                    <Users className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  {selectedConversation.entity_name}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-hidden">
                  <MessageArea
                    messages={messages}
                    loading={messagesLoading}
                    hasMore={hasMore}
                    onLoadMore={fetchMore}
                    onDeleteMessage={deleteMessage}
                    onEditMessage={editMessage}
                    getAttachmentUrl={getAttachmentUrl}
                  />
                </div>
                <MessageComposer
                  onSend={handleSendMessage}
                  sending={sending}
                  placeholder="Écrivez un message..."
                />
              </CardContent>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Sélectionnez une discussion</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </BEProjectHubLayout>
  );
}
