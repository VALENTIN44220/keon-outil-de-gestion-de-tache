
-- Add new statuses and validation fields to tasks
-- Note: status is already a text field, we just need to use new values

-- Create task_attachments table for links and files
CREATE TABLE public.task_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'link', -- 'link' or 'file'
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_attachments
CREATE POLICY "Users can view attachments of their tasks"
ON public.task_attachments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tasks 
    WHERE tasks.id = task_attachments.task_id 
    AND (
      tasks.user_id = auth.uid() 
      OR tasks.assignee_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      OR (tasks.type = 'request' AND tasks.target_department_id IN (SELECT department_id FROM profiles WHERE user_id = auth.uid()))
    )
  )
);

CREATE POLICY "Users can add attachments to accessible tasks"
ON public.task_attachments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tasks 
    WHERE tasks.id = task_attachments.task_id 
    AND (
      tasks.user_id = auth.uid() 
      OR tasks.assignee_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      OR (tasks.type = 'request' AND tasks.target_department_id IN (SELECT department_id FROM profiles WHERE user_id = auth.uid()))
    )
  )
);

CREATE POLICY "Users can delete their own attachments"
ON public.task_attachments FOR DELETE
USING (uploaded_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Add validation fields to tasks
ALTER TABLE public.tasks 
ADD COLUMN validator_id UUID REFERENCES public.profiles(id),
ADD COLUMN validation_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN validated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN validation_comment TEXT,
ADD COLUMN requires_validation BOOLEAN DEFAULT false,
ADD COLUMN current_validation_level INTEGER DEFAULT 0;

-- Create task_validation_levels for multi-level validation config
CREATE TABLE public.task_validation_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1,
  validator_id UUID REFERENCES public.profiles(id),
  validator_department_id UUID REFERENCES public.departments(id),
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'validated', 'refused'
  validated_at TIMESTAMP WITH TIME ZONE,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.task_validation_levels ENABLE ROW LEVEL SECURITY;

-- RLS for validation levels
CREATE POLICY "Users can view validation levels of accessible tasks"
ON public.task_validation_levels FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tasks 
    WHERE tasks.id = task_validation_levels.task_id 
    AND (
      tasks.user_id = auth.uid() 
      OR tasks.assignee_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      OR tasks.validator_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  )
);

CREATE POLICY "Validators can update their validation levels"
ON public.task_validation_levels FOR UPDATE
USING (
  validator_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR validator_department_id IN (SELECT department_id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Task owners can insert validation levels"
ON public.task_validation_levels FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tasks 
    WHERE tasks.id = task_validation_levels.task_id 
    AND tasks.user_id = auth.uid()
  )
);

-- Add validation config to task_templates
ALTER TABLE public.task_templates
ADD COLUMN requires_validation BOOLEAN DEFAULT false;

-- Create template_validation_levels for template validation config
CREATE TABLE public.template_validation_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_template_id UUID NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1,
  validator_profile_id UUID REFERENCES public.profiles(id),
  validator_department_id UUID REFERENCES public.departments(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.template_validation_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their template validation levels"
ON public.template_validation_levels FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM task_templates 
    WHERE task_templates.id = template_validation_levels.task_template_id 
    AND task_templates.user_id = auth.uid()
  )
);

-- Update assignment_rules to include validation config
ALTER TABLE public.assignment_rules
ADD COLUMN requires_validation BOOLEAN DEFAULT false,
ADD COLUMN auto_assign BOOLEAN DEFAULT true;
