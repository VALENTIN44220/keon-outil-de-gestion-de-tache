
ALTER TABLE public.user_filter_presets ADD COLUMN is_default boolean NOT NULL DEFAULT false;

-- Ensure only one default per user+process context
CREATE UNIQUE INDEX idx_user_filter_presets_default 
ON public.user_filter_presets (user_id, COALESCE(process_template_id, '00000000-0000-0000-0000-000000000000'))
WHERE is_default = true;
