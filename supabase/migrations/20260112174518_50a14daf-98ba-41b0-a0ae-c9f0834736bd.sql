-- Add target_department_id to process_templates (for service requests)
ALTER TABLE public.process_templates
ADD COLUMN target_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

-- Add index for better performance
CREATE INDEX idx_process_templates_target_department ON public.process_templates(target_department_id);