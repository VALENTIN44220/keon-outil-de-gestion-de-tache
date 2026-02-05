import { useState, useMemo } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Search, Plus, Users, MessageCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type { ConversationWithDetails } from '@/types/chat';

interface ConversationListProps {
  conversations: ConversationWithDetails[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onNewGroup: () => void;
}

export function ConversationList({
  conversations,
  loading,
  selectedId,
  onSelect,
  onNewChat,
  onNewGroup,
}: ConversationListProps) {
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Hier';
    return format(date, 'dd/MM', { locale: fr });
  };

  const getConversationDisplay = (conv: ConversationWithDetails) => {
    if (conv.type === 'group') {
      return {
        title: conv.title || 'Groupe sans nom',
        avatar: conv.avatar_url,
        initials: conv.title ? getInitials(conv.title) : 'G',
        isGroup: true,
      };
    }
    
    // DM - find the other user
    const otherMember = conv.members.find(m => m.user_id !== profile?.id);
    const otherProfile = otherMember?.profile;
    
    return {
      title: otherProfile?.display_name || 'Utilisateur',
      avatar: otherProfile?.avatar_url,
      initials: getInitials(otherProfile?.display_name),
      isGroup: false,
    };
  };

  const filteredConversations = useMemo(() => {
    return conversations
      .filter(conv => {
        const display = getConversationDisplay(conv);
        const matchesSearch = display.title.toLowerCase().includes(search.toLowerCase());
        const matchesFilter = filter === 'all' || conv.unread_count > 0;
        return matchesSearch && matchesFilter;
      });
  }, [conversations, search, filter, profile?.id]);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
        <div className="flex-1 p-2 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 border-b space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Messages</h2>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={onNewChat} title="Nouveau message">
              <MessageCircle className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onNewGroup} title="Nouveau groupe">
              <Users className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            Tous
          </Button>
          <Button
            variant={filter === 'unread' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('unread')}
          >
            Non lus
          </Button>
        </div>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <MessageCircle className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">
              {search ? 'Aucune conversation trouvée' : 'Aucune conversation'}
            </p>
            {!search && (
              <Button variant="link" size="sm" onClick={onNewChat} className="mt-2">
                Démarrer une conversation
              </Button>
            )}
          </div>
        ) : (
          <div className="p-2">
            {filteredConversations.map((conv) => {
              const display = getConversationDisplay(conv);
              const isSelected = conv.id === selectedId;
              
              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
                    isSelected 
                      ? "bg-primary/10 border-l-4 border-primary" 
                      : "hover:bg-muted"
                  )}
                >
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={display.avatar || undefined} />
                      <AvatarFallback className={cn(
                        "text-sm font-medium",
                        display.isGroup 
                          ? "bg-accent/20 text-accent"
                          : "bg-primary/20 text-primary"
                      )}>
                        {display.initials}
                      </AvatarFallback>
                    </Avatar>
                    {display.isGroup && (
                      <div className="absolute -bottom-1 -right-1 bg-accent rounded-full p-0.5">
                        <Users className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        "font-medium truncate",
                        conv.unread_count > 0 && "font-semibold"
                      )}>
                        {display.title}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatDate(conv.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className={cn(
                        "text-sm truncate",
                        conv.unread_count > 0 
                          ? "text-foreground font-medium" 
                          : "text-muted-foreground"
                      )}>
                        {conv.last_message_preview || 'Aucun message'}
                      </p>
                      {conv.unread_count > 0 && (
                        <Badge 
                          variant="default" 
                          className="h-5 min-w-5 flex items-center justify-center text-xs rounded-full px-1.5 flex-shrink-0"
                        >
                          {conv.unread_count > 99 ? '99+' : conv.unread_count}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
