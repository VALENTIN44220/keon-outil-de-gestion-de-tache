
-- Function to list public tables
CREATE OR REPLACE FUNCTION public.get_public_tables_info()
RETURNS TABLE(table_name text, row_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT t.table_name::text, 
         COALESCE(s.n_live_tup, 0)::bigint as row_count
  FROM information_schema.tables t
  LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name AND s.schemaname = 'public'
  WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
  ORDER BY t.table_name;
$$;

-- Function to list columns for a specific table
CREATE OR REPLACE FUNCTION public.get_table_columns_info(p_table_name text)
RETURNS TABLE(column_name text, data_type text, is_nullable text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.column_name::text, c.data_type::text, c.is_nullable::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' 
    AND c.table_name = p_table_name
  ORDER BY c.ordinal_position;
$$;
