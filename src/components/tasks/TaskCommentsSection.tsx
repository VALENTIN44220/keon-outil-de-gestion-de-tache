import { useState, useRef, useEffect } from 'react';
import { useTaskComments, TaskComment } from '@/hooks/useTaskComments';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, Loader2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface TaskCommentsSectionProps {
  taskId: string;
  className?: string;
}

export function TaskCommentsSection({ taskId, className }: TaskCommentsSectionProps) {
  const { comments, isLoading, isSending, addComment, deleteComment, userProfileId } = useTaskComments(taskId);
  const [message, setMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  const handleSend = async () => {
    if (!message.trim()) return;
    const content = message;
    setMessage('');
    await addComment(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isOwnMessage = (comment: TaskComment) => {
    return comment.author_id === userProfileId;
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex items-center gap-2 pb-3 border-b">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-medium">Échanges</h4>
        <span className="text-xs text-muted-foreground">({comments.length})</span>
      </div>

      <ScrollArea className="flex-1 py-4" ref={scrollRef}>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">Aucun message</p>
            <p className="text-xs">Démarrez la conversation</p>
          </div>
        ) : (
          <div className="space-y-4 pr-4">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className={cn(
                  "flex gap-3",
                  isOwnMessage(comment) && "flex-row-reverse"
                )}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={comment.author?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(comment.author?.display_name)}
                  </AvatarFallback>
                </Avatar>
                
                <div className={cn(
                  "flex flex-col max-w-[75%]",
                  isOwnMessage(comment) && "items-end"
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">
                      {comment.author?.display_name || 'Utilisateur'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(comment.created_at), 'dd MMM HH:mm', { locale: fr })}
                    </span>
                    {isOwnMessage(comment) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-50 hover:opacity-100"
                        onClick={() => deleteComment(comment.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  
                  <div className={cn(
                    "rounded-lg px-3 py-2 text-sm",
                    isOwnMessage(comment) 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted"
                  )}>
                    <p className="whitespace-pre-wrap break-words">{comment.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="pt-3 border-t">
        <div className="flex gap-2">
          <Textarea
            placeholder="Écrire un message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            className="resize-none"
            disabled={isSending}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!message.trim() || isSending}
            className="shrink-0"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
