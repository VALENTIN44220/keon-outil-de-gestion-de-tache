import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface OutlookEvent {
  id: string;
  user_id: string;
  outlook_event_id: string;
  subject: string;
  start_time: string;
  end_time: string;
  location?: string;
  is_all_day: boolean;
  organizer_email?: string;
  attendees?: any;
  color?: string;
}

export function useOutlookCalendar(
  startDate?: Date,
  endDate?: Date,
  includeSubordinates: boolean = false
) {
  const { user } = useAuth();
  const [events, setEvents] = useState<OutlookEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    if (!user) {
      setEvents([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const start = startDate || new Date();
      const end = endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const { data, error } = await supabase.functions.invoke('microsoft-graph', {
        body: {
          action: 'get-calendar-events',
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          includeSubordinates,
        },
      });

      if (error) throw error;
      setEvents(data.events || []);
    } catch (error) {
      console.error('Error fetching Outlook events:', error);
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, startDate, endDate, includeSubordinates]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    isLoading,
    refetch: fetchEvents,
  };
}
