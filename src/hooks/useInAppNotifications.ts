import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface InAppNotificationRow {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

export function useInAppNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<InAppNotificationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUnread = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('useInAppNotifications:', error);
        setItems([]);
        return;
      }
      setItems((data || []) as InAppNotificationRow[]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchUnread();
  }, [fetchUnread]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('in-app-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void fetchUnread();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, fetchUnread]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (!user?.id) return;
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('markAsRead notification:', error);
        return;
      }
      setItems((prev) => prev.filter((n) => n.id !== id));
    },
    [user?.id]
  );

  return {
    notifications: items,
    unreadCount: items.length,
    isLoading,
    refetch: fetchUnread,
    markAsRead,
  };
}
