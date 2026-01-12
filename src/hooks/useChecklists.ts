import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ChecklistItem } from '@/types/checklist';

export function useChecklists(taskId?: string) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchChecklists = useCallback(async () => {
    if (!taskId) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('task_checklists')
      .select('*')
      .eq('task_id', taskId)
      .order('order_index', { ascending: true });

    if (error) {
      console.error('Error fetching checklists:', error);
    } else {
      setItems((data || []) as ChecklistItem[]);
    }
    setIsLoading(false);
  }, [taskId]);

  useEffect(() => {
    fetchChecklists();
  }, [fetchChecklists]);

  const addItem = async (title: string) => {
    if (!taskId) return;

    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.order_index)) : -1;
    
    const { data, error } = await supabase
      .from('task_checklists')
      .insert({
        task_id: taskId,
        title,
        order_index: maxOrder + 1,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible d\'ajouter l\'élément',
        variant: 'destructive',
      });
    } else {
      setItems(prev => [...prev, data as ChecklistItem]);
    }
  };

  const toggleItem = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const newCompleted = !item.is_completed;
    
    const { error } = await supabase
      .from('task_checklists')
      .update({
        is_completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null,
        completed_by: newCompleted && profile ? profile.id : null,
      })
      .eq('id', itemId);

    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour l\'élément',
        variant: 'destructive',
      });
    } else {
      setItems(prev => 
        prev.map(i => 
          i.id === itemId 
            ? { 
                ...i, 
                is_completed: newCompleted,
                completed_at: newCompleted ? new Date().toISOString() : null,
                completed_by: newCompleted && profile ? profile.id : null,
              }
            : i
        )
      );
    }
  };

  const deleteItem = async (itemId: string) => {
    const { error } = await supabase
      .from('task_checklists')
      .delete()
      .eq('id', itemId);

    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer l\'élément',
        variant: 'destructive',
      });
    } else {
      setItems(prev => prev.filter(i => i.id !== itemId));
    }
  };

  const updateItem = async (itemId: string, title: string) => {
    const { error } = await supabase
      .from('task_checklists')
      .update({ title })
      .eq('id', itemId);

    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de modifier l\'élément',
        variant: 'destructive',
      });
    } else {
      setItems(prev => 
        prev.map(i => i.id === itemId ? { ...i, title } : i)
      );
    }
  };

  const progress = items.length > 0 
    ? Math.round((items.filter(i => i.is_completed).length / items.length) * 100)
    : 0;

  const completedCount = items.filter(i => i.is_completed).length;

  return {
    items,
    isLoading,
    addItem,
    toggleItem,
    deleteItem,
    updateItem,
    progress,
    completedCount,
    totalCount: items.length,
    refetch: fetchChecklists,
  };
}

// Hook for fetching progress of multiple tasks
export function useTasksProgress(taskIds: string[]) {
  const [progressMap, setProgressMap] = useState<Record<string, { completed: number; total: number; progress: number }>>({});
  const [isLoading, setIsLoading] = useState(false);

  const fetchAllProgress = useCallback(async () => {
    if (taskIds.length === 0) {
      setProgressMap({});
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from('task_checklists')
      .select('task_id, is_completed')
      .in('task_id', taskIds);

    if (error) {
      console.error('Error fetching task progress:', error);
    } else {
      const newProgressMap: Record<string, { completed: number; total: number; progress: number }> = {};
      
      // Initialize all tasks with 0
      taskIds.forEach(id => {
        newProgressMap[id] = { completed: 0, total: 0, progress: 0 };
      });

      // Calculate progress for each task
      (data || []).forEach((item: { task_id: string; is_completed: boolean }) => {
        if (!newProgressMap[item.task_id]) {
          newProgressMap[item.task_id] = { completed: 0, total: 0, progress: 0 };
        }
        newProgressMap[item.task_id].total++;
        if (item.is_completed) {
          newProgressMap[item.task_id].completed++;
        }
      });

      // Calculate percentage
      Object.keys(newProgressMap).forEach(id => {
        const { completed, total } = newProgressMap[id];
        newProgressMap[id].progress = total > 0 ? Math.round((completed / total) * 100) : 0;
      });

      setProgressMap(newProgressMap);
    }
    setIsLoading(false);
  }, [taskIds.join(',')]);

  useEffect(() => {
    fetchAllProgress();
  }, [fetchAllProgress]);

  // Calculate global progress
  const globalStats = Object.values(progressMap).reduce(
    (acc, curr) => ({
      completed: acc.completed + curr.completed,
      total: acc.total + curr.total,
    }),
    { completed: 0, total: 0 }
  );

  const globalProgress = globalStats.total > 0 
    ? Math.round((globalStats.completed / globalStats.total) * 100) 
    : 0;

  return {
    progressMap,
    isLoading,
    globalProgress,
    globalStats,
    refetch: fetchAllProgress,
  };
}
