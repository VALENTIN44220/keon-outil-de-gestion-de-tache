import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BETaskLabel } from '@/types/beProject';

export function useBETaskLabels() {
  const [labels, setLabels] = useState<BETaskLabel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLabels = async () => {
      try {
        const { data, error } = await supabase
          .from('be_task_labels')
          .select('*')
          .eq('is_active', true)
          .order('order_index');

        if (error) throw error;
        setLabels((data as BETaskLabel[]) || []);
      } catch (error) {
        console.error('Error fetching BE task labels:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLabels();
  }, []);

  return { labels, isLoading };
}
