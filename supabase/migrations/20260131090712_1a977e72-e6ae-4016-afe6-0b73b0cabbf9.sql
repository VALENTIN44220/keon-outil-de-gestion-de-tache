-- Add a settings JSONB column to process_templates for storing tab configurations
-- This column will store notification_config, assignment_config, and other tab settings

ALTER TABLE public.process_templates 
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Add comment explaining the structure
COMMENT ON COLUMN public.process_templates.settings IS 'JSONB storage for process configuration including notification_config and assignment_config';

-- Create an index for faster JSON queries if needed
CREATE INDEX IF NOT EXISTS idx_process_templates_settings ON public.process_templates USING gin(settings);