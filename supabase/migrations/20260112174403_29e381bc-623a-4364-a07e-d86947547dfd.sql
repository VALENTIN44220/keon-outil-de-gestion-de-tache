-- Add category and subcategory to process_templates
ALTER TABLE public.process_templates
ADD COLUMN category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
ADD COLUMN subcategory_id uuid REFERENCES public.subcategories(id) ON DELETE SET NULL;

-- Add index for better performance
CREATE INDEX idx_process_templates_category ON public.process_templates(category_id);
CREATE INDEX idx_process_templates_subcategory ON public.process_templates(subcategory_id);