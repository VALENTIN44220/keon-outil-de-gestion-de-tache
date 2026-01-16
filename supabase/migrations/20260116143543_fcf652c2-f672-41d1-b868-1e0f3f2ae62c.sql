-- Add target_company_id column to process_templates
ALTER TABLE public.process_templates 
ADD COLUMN target_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX idx_process_templates_target_company ON public.process_templates(target_company_id);