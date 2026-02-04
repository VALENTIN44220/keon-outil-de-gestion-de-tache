-- Add validation configuration column to sub_process_templates
ALTER TABLE public.sub_process_templates 
ADD COLUMN IF NOT EXISTS validation_config JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.sub_process_templates.validation_config IS 
'JSON array of validation levels, each with: level (number), type (manager|requester|user), userId (optional), timing (before_start|before_close)';