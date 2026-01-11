-- Add is_shared column to process_templates for sharing with other users
ALTER TABLE public.process_templates ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT true;

-- Add is_shared column to task_templates for standalone templates
ALTER TABLE public.task_templates ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT true;

-- Update RLS policies to allow viewing shared templates from other users
-- Drop existing select policy first
DROP POLICY IF EXISTS "Users can view own process templates" ON public.process_templates;

-- Create new policy that allows viewing own OR shared templates
CREATE POLICY "Users can view own or shared process templates"
ON public.process_templates
FOR SELECT
USING (user_id = auth.uid() OR is_shared = true);

-- Similar update for task_templates
DROP POLICY IF EXISTS "Users can view own task templates" ON public.task_templates;

CREATE POLICY "Users can view own or shared task templates"
ON public.task_templates
FOR SELECT
USING (user_id = auth.uid() OR is_shared = true);