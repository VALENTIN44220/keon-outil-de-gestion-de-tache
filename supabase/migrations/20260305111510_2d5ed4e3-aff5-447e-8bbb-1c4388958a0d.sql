
-- Add is_global flag: when true, this preset is the standard for ALL users
ALTER TABLE public.user_filter_presets ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false;

-- Add visible_columns to store column visibility (already stored in filters JSONB for suppliers, but let's add a dedicated column for consistency)
ALTER TABLE public.user_filter_presets ADD COLUMN IF NOT EXISTS visible_columns jsonb DEFAULT NULL;

-- Allow any authenticated user to read global presets (from any user)
CREATE POLICY "Authenticated users can read global presets"
  ON public.user_filter_presets
  FOR SELECT
  TO authenticated
  USING (is_global = true);
