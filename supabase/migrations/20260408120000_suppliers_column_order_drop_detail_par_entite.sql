-- Remove deprecated enrichment field
ALTER TABLE public.supplier_purchase_enrichment
  DROP COLUMN IF EXISTS detail_par_entite;

-- Per-user column order for /suppliers list table (JSON array of column keys)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suppliers_list_column_order jsonb DEFAULT NULL;

COMMENT ON COLUMN public.profiles.suppliers_list_column_order IS
  'Ordered list of supplier table column keys for /suppliers route; null = app default order.';
