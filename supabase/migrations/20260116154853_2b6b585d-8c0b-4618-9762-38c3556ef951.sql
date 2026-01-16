-- Add new custom field type 'table_lookup' to the enum
ALTER TYPE public.custom_field_type ADD VALUE IF NOT EXISTS 'table_lookup';

-- Add columns for table lookup configuration
ALTER TABLE public.template_custom_fields 
ADD COLUMN IF NOT EXISTS lookup_table TEXT,
ADD COLUMN IF NOT EXISTS lookup_value_column TEXT,
ADD COLUMN IF NOT EXISTS lookup_label_column TEXT;