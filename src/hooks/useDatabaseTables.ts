import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DbTableInfo {
  table_name: string;
  row_count: number;
}

export interface DbColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

export function useDatabaseTables() {
  const [tables, setTables] = useState<DbTableInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTables = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_public_tables_info');
      if (error) throw error;
      setTables((data as any[]) || []);
    } catch (error) {
      console.error('Error fetching tables:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  return { tables, isLoading, refetch: fetchTables };
}

export function useTableColumns(tableName: string | null) {
  const [columns, setColumns] = useState<DbColumnInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchColumns = useCallback(async () => {
    if (!tableName) {
      setColumns([]);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_table_columns_info', { p_table_name: tableName });
      if (error) throw error;
      setColumns((data as any[]) || []);
    } catch (error) {
      console.error('Error fetching columns:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tableName]);

  useEffect(() => {
    fetchColumns();
  }, [fetchColumns]);

  return { columns, isLoading };
}
