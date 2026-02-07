import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface RequestMention {
  id: string;
  request_number: string;
  title: string;
  status: string;
}

export function useRequestMentions() {
  const { profile } = useAuth();
  const [suggestions, setSuggestions] = useState<RequestMention[]>([]);
  const [loading, setLoading] = useState(false);

  // Search requests by number or title
  const searchRequests = useCallback(async (query: string) => {
    if (!query || query.length < 1) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const searchTerm = query.toUpperCase();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('tasks')
        .select('id, request_number, title, status')
        .eq('task_type', 'request')
        .not('request_number', 'is', null)
        .or(`request_number.ilike.%${searchTerm}%,title.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const results = (data || []) as Array<{ id: string; request_number: string | null; title: string; status: string }>;

      setSuggestions(
        results.map(r => ({
          id: r.id,
          request_number: r.request_number || '',
          title: r.title,
          status: r.status,
        }))
      );
    } catch (error) {
      console.error('Error searching requests:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Navigate to or create chat for a request
  const getOrCreateRequestChat = useCallback(async (requestId: string): Promise<string | null> => {
    if (!profile?.id) return null;

    try {
      const { data, error } = await supabase.rpc('find_or_create_request_chat', {
        _request_id: requestId,
        _user_id: profile.id,
      });

      if (error) throw error;
      return data as string;
    } catch (error) {
      console.error('Error getting/creating request chat:', error);
      return null;
    }
  }, [profile?.id]);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  return {
    suggestions,
    loading,
    searchRequests,
    getOrCreateRequestChat,
    clearSuggestions,
  };
}
