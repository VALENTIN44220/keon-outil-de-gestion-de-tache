import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TemplateChecklistItem } from '@/types/templateChecklist';

export function useTemplateChecklists(taskTemplateId?: string) {
  const { toast } = useToast();
  const [items, setItems] = useState<TemplateChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchChecklists = useCallback(async () => {
    if (!taskTemplateId) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('task_template_checklists')
      .select('*')
      .eq('task_template_id', taskTemplateId)
      .order('order_index', { ascending: true });

    if (error) {
      console.error('Error fetching template checklists:', error);
    } else {
      setItems((data || []) as TemplateChecklistItem[]);
    }
    setIsLoading(false);
  }, [taskTemplateId]);

  useEffect(() => {
    fetchChecklists();
  }, [fetchChecklists]);

  const addItem = async (title: string) => {
    if (!taskTemplateId) return;

    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.order_index)) : -1;
    
    const { data, error } = await supabase
      .from('task_template_checklists')
      .insert({
        task_template_id: taskTemplateId,
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
      setItems(prev => [...prev, data as TemplateChecklistItem]);
    }
  };

  const deleteItem = async (itemId: string) => {
    const { error } = await supabase
      .from('task_template_checklists')
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
      .from('task_template_checklists')
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

  return {
    items,
    isLoading,
    addItem,
    deleteItem,
    updateItem,
    refetch: fetchChecklists,
  };
}

// Hook for fetching checklists for multiple templates at once
export function useAllTemplateChecklists(taskTemplateIds: string[]) {
  const [checklistsMap, setChecklistsMap] = useState<Record<string, TemplateChecklistItem[]>>({});
  const [isLoading, setIsLoading] = useState(false);

  const fetchAllChecklists = useCallback(async () => {
    if (taskTemplateIds.length === 0) {
      setChecklistsMap({});
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from('task_template_checklists')
      .select('*')
      .in('task_template_id', taskTemplateIds)
      .order('order_index', { ascending: true });

    if (error) {
      console.error('Error fetching template checklists:', error);
    } else {
      const newMap: Record<string, TemplateChecklistItem[]> = {};
      
      // Initialize all templates with empty arrays
      taskTemplateIds.forEach(id => {
        newMap[id] = [];
      });

      // Populate with data
      (data || []).forEach((item: TemplateChecklistItem) => {
        if (!newMap[item.task_template_id]) {
          newMap[item.task_template_id] = [];
        }
        newMap[item.task_template_id].push(item);
      });

      setChecklistsMap(newMap);
    }
    setIsLoading(false);
  }, [taskTemplateIds.join(',')]);

  useEffect(() => {
    fetchAllChecklists();
  }, [fetchAllChecklists]);

  return {
    checklistsMap,
    isLoading,
    refetch: fetchAllChecklists,
  };
}
