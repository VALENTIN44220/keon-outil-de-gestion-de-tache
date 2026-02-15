
-- Table for saving/loading widget layout presets across dashboards
CREATE TABLE public.widget_layout_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  widgets_config JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.widget_layout_presets ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own presets
CREATE POLICY "Users can view their own presets" ON public.widget_layout_presets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own presets" ON public.widget_layout_presets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own presets" ON public.widget_layout_presets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own presets" ON public.widget_layout_presets FOR DELETE USING (auth.uid() = user_id);

-- Also create a dashboard_configs table that supports service groups (no FK to process_templates)
-- We'll add a scope_type + scope_id pattern instead
ALTER TABLE public.process_dashboard_configs 
  DROP CONSTRAINT IF EXISTS process_dashboard_configs_process_template_id_fkey;

-- Now process_template_id can hold any scope ID (process template OR service group)
