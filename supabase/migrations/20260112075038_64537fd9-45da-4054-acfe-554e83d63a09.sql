
-- Create sub_process_templates table (the actual workflows that generate tasks)
CREATE TABLE public.sub_process_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_template_id UUID NOT NULL REFERENCES public.process_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  assignment_type TEXT NOT NULL DEFAULT 'manager' CHECK (assignment_type IN ('manager', 'user', 'role')),
  target_assignee_id UUID REFERENCES public.profiles(id),
  target_department_id UUID REFERENCES public.departments(id),
  target_job_title_id UUID REFERENCES public.job_titles(id),
  order_index INTEGER NOT NULL DEFAULT 0,
  is_shared BOOLEAN NOT NULL DEFAULT true,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add sub_process_template_id to task_templates (replacing process_template_id link)
ALTER TABLE public.task_templates 
ADD COLUMN sub_process_template_id UUID REFERENCES public.sub_process_templates(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE public.sub_process_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sub_process_templates
CREATE POLICY "Users can view own or shared sub_process_templates"
ON public.sub_process_templates
FOR SELECT
USING ((user_id = auth.uid()) OR (is_shared = true));

CREATE POLICY "Users can insert their own sub_process_templates"
ON public.sub_process_templates
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sub_process_templates"
ON public.sub_process_templates
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sub_process_templates"
ON public.sub_process_templates
FOR DELETE
USING (auth.uid() = user_id);

-- Add source_sub_process_template_id to tasks for tracking
ALTER TABLE public.tasks
ADD COLUMN source_sub_process_template_id UUID REFERENCES public.sub_process_templates(id);
