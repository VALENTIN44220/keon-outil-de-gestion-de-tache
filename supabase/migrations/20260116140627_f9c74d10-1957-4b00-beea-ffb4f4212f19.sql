-- Add target_manager_id column to sub_process_templates for specifying which manager should receive assignment tasks
ALTER TABLE public.sub_process_templates 
ADD COLUMN target_manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add comment to explain the field
COMMENT ON COLUMN public.sub_process_templates.target_manager_id IS 'The specific manager who will receive assignment tasks when assignment_type is manager';