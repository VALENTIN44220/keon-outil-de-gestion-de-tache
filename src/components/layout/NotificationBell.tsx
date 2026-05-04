import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useWorkflowNotifications, useMarkWorkflowNotificationRead, useMarkAllWorkflowNotificationsRead } from '@/hooks/useWorkflowNotifications';

const TYPE_LABELS: Record<string, string> = {
  supplier_rejection:        'Demande refusée',
  supplier_deleted:          'Demande retirée',
  supplier_review_requested: 'Modifications demandées',
  supplier_achat_validated:  'Validation achats',
};

/** Types de notifications liées à une demande fournisseur dont le demandeur doit voir le détail. */
const REQUESTER_NOTIF_TYPES = new Set(['supplier_review_requested']);

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: notifications = [] } = useWorkflowNotifications();
  const { mutate: markRead } = useMarkWorkflowNotificationRead();
  const { mutate: markAllRead } = useMarkAllWorkflowNotificationsRead();

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  function handleNotifClick(notif: (typeof notifications)[number]) {
    if (!notif.read_at) markRead(notif.id);
    setOpen(false);
    // Si c'est une demande de modifications → ouvre directement la demande dans "Mes demandes"
    if (REQUESTER_NOTIF_TYPES.has(notif.type ?? '')) {
      const params = new URLSearchParams({ myRequests: 'true' });
      if (notif.related_entity_id) params.set('requestId', notif.related_entity_id);
      navigate(`/suppliers?${params.toString()}`);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2 text-muted-foreground"
              onClick={() => markAllRead()}
            >
              Tout marquer comme lu
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune notification.</p>
          ) : (
            <ul className="divide-y">
              {notifications.map((notif) => (
                <li
                  key={notif.id}
                  className={`px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${!notif.read_at ? 'bg-primary/5' : ''}`}
                  onClick={() => handleNotifClick(notif)}
                >
                  <div className="flex items-start gap-2">
                    {!notif.read_at && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                    <div className={`flex-1 min-w-0 ${notif.read_at ? 'pl-4' : ''}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold truncate">{notif.title}</p>
                        {notif.type && TYPE_LABELS[notif.type] && (
                          <Badge variant="outline" className="text-[10px] shrink-0 py-0">
                            {TYPE_LABELS[notif.type]}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {format(new Date(notif.created_at), "dd/MM/yyyy à HH:mm", { locale: fr })}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
