import { useCallback, useEffect, useId, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';

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
  const { isSimulating, simulatedProfile } = useSimulation();
  // En simulation, on regarde la boîte de notifs de l'utilisateur incarné
  // (profiles.user_id = auth user_id du simulé). Côté DB, l'admin doit avoir
  // un bypass RLS pour SELECT sur notifications (sinon ces lignes seront
  // filtrées par RLS et retourneront empty).
  const effectiveUserId = isSimulating && simulatedProfile?.user_id
    ? simulatedProfile.user_id
    : user?.id;

  const [items, setItems] = useState<InAppNotificationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Unique channel name per hook instance — see useCommentNotifications for rationale.
  const instanceId = useId();

  const fetchUnread = useCallback(async () => {
    if (!effectiveUserId) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', effectiveUserId)
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
  }, [effectiveUserId]);

  useEffect(() => {
    void fetchUnread();
  }, [fetchUnread]);

  useEffect(() => {
    if (!effectiveUserId) return;

    const channel = supabase
      .channel(`in-app-notifications:${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${effectiveUserId}`,
        },
        () => {
          void fetchUnread();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [effectiveUserId, fetchUnread, instanceId]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (!effectiveUserId) return;
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', effectiveUserId);

      if (error) {
        console.error('markAsRead notification:', error);
        return;
      }
      setItems((prev) => prev.filter((n) => n.id !== id));
    },
    [effectiveUserId]
  );

  /** Marque toutes les notifications de l'utilisateur comme lues (vide la liste). */
  const deleteAll = useCallback(async () => {
    if (!effectiveUserId) return;
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', effectiveUserId)
      .is('read_at', null);
    if (error) {
      console.error('deleteAll notifications:', error);
      return;
    }
    setItems([]);
  }, [effectiveUserId]);

  return {
    notifications: items,
    unreadCount: items.length,
    isLoading,
    refetch: fetchUnread,
    markAsRead,
    deleteAll,
  };
}
