-- Create task_template_checklists table for template sub-actions
CREATE TABLE public.task_template_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_template_id UUID NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_template_checklists ENABLE ROW LEVEL SECURITY;

-- Create policies - users can manage checklists of their own task templates
CREATE POLICY "Users can view checklists of their task templates"
ON public.task_template_checklists
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.task_templates 
    WHERE task_templates.id = task_template_checklists.task_template_id 
    AND task_templates.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert checklists to their task templates"
ON public.task_template_checklists
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.task_templates 
    WHERE task_templates.id = task_template_checklists.task_template_id 
    AND task_templates.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update checklists of their task templates"
ON public.task_template_checklists
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.task_templates 
    WHERE task_templates.id = task_template_checklists.task_template_id 
    AND task_templates.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete checklists of their task templates"
ON public.task_template_checklists
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.task_templates 
    WHERE task_templates.id = task_template_checklists.task_template_id 
    AND task_templates.user_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_task_template_checklists_updated_at
BEFORE UPDATE ON public.task_template_checklists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_task_template_checklists_task_template_id ON public.task_template_checklists(task_template_id);