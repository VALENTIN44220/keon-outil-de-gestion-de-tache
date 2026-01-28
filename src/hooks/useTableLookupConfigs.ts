import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TableLookupConfig {
  id: string;
  table_name: string;
  display_column: string;
  value_column: string;
  label: string;
  description: string | null;
  filter_column: string | null;
  filter_value: string | null;
  is_active: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export function useTableLookupConfigs() {
  const [configs, setConfigs] = useState<TableLookupConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfigs = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_table_lookup_configs')
        .select('*')
        .order('order_index', { ascending: true });

      if (error) throw error;
      setConfigs(data || []);
    } catch (error) {
      console.error('Error fetching table lookup configs:', error);
      toast.error('Erreur lors du chargement des configurations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const addConfig = async (config: Omit<TableLookupConfig, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('admin_table_lookup_configs')
        .insert(config)
        .select()
        .single();

      if (error) throw error;
      setConfigs((prev) => [...prev, data].sort((a, b) => a.order_index - b.order_index));
      toast.success('Configuration ajoutée');
      return data;
    } catch (error: any) {
      console.error('Error adding config:', error);
      if (error.code === '23505') {
        toast.error('Cette combinaison table/colonnes existe déjà');
      } else {
        toast.error("Erreur lors de l'ajout");
      }
      throw error;
    }
  };

  const updateConfig = async (id: string, updates: Partial<TableLookupConfig>) => {
    try {
      const { error } = await supabase
        .from('admin_table_lookup_configs')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      setConfigs((prev) =>
        prev
          .map((c) => (c.id === id ? { ...c, ...updates } : c))
          .sort((a, b) => a.order_index - b.order_index)
      );
      toast.success('Configuration mise à jour');
    } catch (error) {
      console.error('Error updating config:', error);
      toast.error('Erreur lors de la mise à jour');
      throw error;
    }
  };

  const deleteConfig = async (id: string) => {
    try {
      const { error } = await supabase
        .from('admin_table_lookup_configs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setConfigs((prev) => prev.filter((c) => c.id !== id));
      toast.success('Configuration supprimée');
    } catch (error) {
      console.error('Error deleting config:', error);
      toast.error('Erreur lors de la suppression');
      throw error;
    }
  };

  const deleteMultiple = async (ids: string[]) => {
    try {
      const { error } = await supabase
        .from('admin_table_lookup_configs')
        .delete()
        .in('id', ids);

      if (error) throw error;
      setConfigs((prev) => prev.filter((c) => !ids.includes(c.id)));
      toast.success(`${ids.length} configuration(s) supprimée(s)`);
    } catch (error) {
      console.error('Error deleting configs:', error);
      toast.error('Erreur lors de la suppression');
      throw error;
    }
  };

  return {
    configs,
    activeConfigs: configs.filter((c) => c.is_active),
    isLoading,
    addConfig,
    updateConfig,
    deleteConfig,
    deleteMultiple,
    refetch: fetchConfigs,
  };
}
