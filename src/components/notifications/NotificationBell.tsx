import { Bell, AlertTriangle, Clock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TaskNotification } from '@/hooks/useNotifications';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface NotificationBellProps {
  notifications: TaskNotification[];
  unreadCount: number;
  hasUrgent: boolean;
  onNotificationClick?: (taskId: string) => void;
}

export function NotificationBell({
  notifications,
  unreadCount,
  hasUrgent,
  onNotificationClick,
}: NotificationBellProps) {
  const getIcon = (type: TaskNotification['type']) => {
    switch (type) {
      case 'overdue':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'due-today':
        return <Clock className="h-4 w-4 text-warning" />;
      case 'due-soon':
        return <Calendar className="h-4 w-4 text-info" />;
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
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className={cn(
                'absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium text-primary-foreground',
                hasUrgent ? 'bg-destructive animate-pulse' : 'bg-primary'
              )}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-4 py-3">
          <h3 className="font-semibold text-foreground">Notifications</h3>
          <p className="text-sm text-muted-foreground">
            {unreadCount === 0
              ? 'Aucune notification'
              : `${unreadCount} tâche${unreadCount > 1 ? 's' : ''} nécessite${unreadCount > 1 ? 'nt' : ''} votre attention`}
          </p>
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/50 mb-2" />
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
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(parseISO(notification.dueDate), 'EEEE d MMMM', {
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
      </PopoverContent>
    </Popover>
  );
}
