import { useEffect, useRef, useCallback } from 'react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import type { ChatMessage } from '@/types/chat';
import { MessageBubble } from './MessageBubble';

interface MessageAreaProps {
  messages: ChatMessage[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onDeleteMessage: (id: string) => void;
  onEditMessage: (id: string, content: string) => void;
  getAttachmentUrl: (path: string) => Promise<string | null>;
}

export function MessageArea({
  messages,
  loading,
  hasMore,
  onLoadMore,
  onDeleteMessage,
  onEditMessage,
  getAttachmentUrl,
}: MessageAreaProps) {
  const { profile } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessagesLength = useRef(messages.length);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessagesLength.current = messages.length;
  }, [messages.length]);

  // Format date separator
  const formatDateSeparator = (date: Date) => {
    if (isToday(date)) return "Aujourd'hui";
    if (isYesterday(date)) return 'Hier';
    return format(date, 'EEEE d MMMM yyyy', { locale: fr });
  };

  // Group messages by date
  const groupedMessages = messages.reduce((acc, message, index) => {
    const msgDate = new Date(message.created_at);
    const prevMessage = messages[index - 1];
    const prevDate = prevMessage ? new Date(prevMessage.created_at) : null;
    
    const needsSeparator = !prevDate || !isSameDay(msgDate, prevDate);
    
    if (needsSeparator) {
      acc.push({ type: 'separator' as const, date: msgDate, id: `sep-${message.id}` });
    }
    
    acc.push({ type: 'message' as const, message, id: message.id });
    
    return acc;
  }, [] as Array<{ type: 'separator'; date: Date; id: string } | { type: 'message'; message: ChatMessage; id: string }>);

  if (messages.length === 0 && !loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg mb-2">Aucun message</p>
          <p className="text-sm">Envoyez un message pour démarrer la conversation</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 px-4" ref={scrollRef}>
      {/* Load more button */}
      {hasMore && (
        <div className="flex justify-center py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Chargement...
              </>
            ) : (
              'Charger plus de messages'
            )}
          </Button>
        </div>
      )}

      {/* Messages */}
      <div className="space-y-4 py-4">
        {groupedMessages.map((item) => {
          if (item.type === 'separator') {
            return (
              <div key={item.id} className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground font-medium px-2">
                  {formatDateSeparator(item.date)}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
            );
          }
          
          const message = item.message;
          const isOwn = message.sender_id === profile?.id;
          
          return (
            <MessageBubble
              key={item.id}
              message={message}
              isOwn={isOwn}
              onDelete={() => onDeleteMessage(message.id)}
              onEdit={(content) => onEditMessage(message.id, content)}
              getAttachmentUrl={getAttachmentUrl}
            />
          );
        })}
      </div>

      {/* Bottom anchor for scrolling */}
      <div ref={bottomRef} />
    </ScrollArea>
  );
}
