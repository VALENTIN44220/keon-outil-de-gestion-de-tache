-- Add context_type to user_filter_presets to support different filter contexts (dashboard, projects, etc.)
ALTER TABLE public.user_filter_presets 
ADD COLUMN IF NOT EXISTS context_type text NOT NULL DEFAULT 'dashboard';

-- Create index for faster lookups by context
CREATE INDEX IF NOT EXISTS idx_user_filter_presets_context 
ON public.user_filter_presets (user_id, context_type);
