import { Bell, AlertTriangle, Clock, Calendar, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TaskNotification } from '@/hooks/useNotifications';
import { CommentNotification } from '@/hooks/useCommentNotifications';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface NotificationBellProps {
  notifications: TaskNotification[];
  commentNotifications?: CommentNotification[];
  unreadCount: number;
  hasUrgent: boolean;
  onNotificationClick?: (taskId: string) => void;
  onCommentNotificationClick?: (taskId: string, notificationId: string) => void;
}

export function NotificationBell({
  notifications,
  commentNotifications = [],
  unreadCount,
  hasUrgent,
  onNotificationClick,
  onCommentNotificationClick,
}: NotificationBellProps) {
  const totalUnread = unreadCount + commentNotifications.filter(n => !n.isRead).length;
  const hasUnreadComments = commentNotifications.some(n => !n.isRead);

  const getIcon = (type: TaskNotification['type']) => {
    switch (type) {
      case 'overdue':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'due-today':
        return <Clock className="h-4 w-4 text-warning" />;
      case 'due-soon':
        return <Calendar className="h-4 w-4 text-info" />;
      case 'new-comment':
        return <MessageSquare className="h-4 w-4 text-primary" />;
    }
  };

  const getBgColor = (type: TaskNotification['type']) => {
    switch (type) {
      case 'overdue':
        return 'bg-destructive/10 border-destructive/20';
      case 'due-today':
        return 'bg-warning/10 border-warning/20';
      case 'due-soon':
        return 'bg-info/10 border-info/20';
      case 'new-comment':
        return 'bg-primary/10 border-primary/20';
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {totalUnread > 0 && (
            <span
              className={cn(
                'absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium text-primary-foreground',
                hasUrgent || hasUnreadComments ? 'bg-destructive animate-pulse' : 'bg-primary'
              )}
            >
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <Tabs defaultValue="deadlines" className="w-full">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-semibold text-foreground mb-2">Notifications</h3>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="deadlines" className="text-xs">
                Échéances
                {unreadCount > 0 && (
                  <span className="ml-1.5 bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="messages" className="text-xs">
                Messages
                {commentNotifications.filter(n => !n.isRead).length > 0 && (
                  <span className="ml-1.5 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                    {commentNotifications.filter(n => !n.isRead).length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="deadlines" className="m-0">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Aucune échéance proche
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-80">
                <div className="divide-y divide-border">
                  {notifications.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => onNotificationClick?.(notification.taskId)}
                      className={cn(
                        'w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors',
                        'focus:outline-none focus:bg-accent/50'
                      )}
                    >
                      <div className="flex gap-3">
                        <div
                          className={cn(
                            'flex-shrink-0 mt-0.5 p-1.5 rounded-full border',
                            getBgColor(notification.type)
                          )}
                        >
                          {getIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {notification.taskTitle}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {notification.message}
                          </p>
                          {notification.dueDate && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(parseISO(notification.dueDate), 'EEEE d MMMM', {
                                locale: fr,
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="messages" className="m-0">
            {commentNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Aucun nouveau message
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-80">
                <div className="divide-y divide-border">
                  {commentNotifications.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => onCommentNotificationClick?.(notification.taskId, notification.id)}
                      className={cn(
                        'w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors',
                        'focus:outline-none focus:bg-accent/50',
                        !notification.isRead && 'bg-primary/5'
                      )}
                    >
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 mt-0.5 p-1.5 rounded-full border bg-primary/10 border-primary/20">
                          <MessageSquare className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground truncate">
                              {notification.authorName}
                            </p>
                            {!notification.isRead && (
                              <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            sur "{notification.taskTitle}"
                          </p>
                          <p className="text-xs text-foreground/80 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(parseISO(notification.createdAt), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
