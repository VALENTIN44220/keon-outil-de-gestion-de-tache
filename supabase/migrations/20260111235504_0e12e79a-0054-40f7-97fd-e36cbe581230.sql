-- Add parent_request_id to tasks to link generated tasks to their source request
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS parent_request_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;

-- Add is_assignment_task flag to identify assignment tasks
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS is_assignment_task boolean NOT NULL DEFAULT false;

-- Add process_template_id to link requests to their template
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS source_process_template_id uuid REFERENCES public.process_templates(id) ON DELETE SET NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_tasks_parent_request_id ON public.tasks(parent_request_id);
CREATE INDEX IF NOT EXISTS idx_tasks_is_assignment_task ON public.tasks(is_assignment_task) WHERE is_assignment_task = true;

-- Add RLS policy for viewing child tasks of requests you can see
CREATE POLICY "Users can view child tasks of their requests" 
ON public.tasks 
FOR SELECT 
USING (
  parent_request_id IN (
    SELECT id FROM public.tasks 
    WHERE user_id = auth.uid() 
    OR assignee_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

-- Add RLS policy for managers to assign tasks in their department
CREATE POLICY "Managers can update unassigned tasks for their department" 
ON public.tasks 
FOR UPDATE 
USING (
  assignee_id IS NULL 
  AND target_department_id IN (
    SELECT department_id FROM profiles WHERE user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM profiles p
    JOIN permission_profiles pp ON p.permission_profile_id = pp.id
    WHERE p.user_id = auth.uid() 
    AND (pp.can_assign_to_subordinates = true OR pp.can_assign_to_all = true)
  )
);

-- Link subcategories to process templates for automatic process generation
ALTER TABLE public.subcategories 
ADD COLUMN IF NOT EXISTS default_process_template_id uuid REFERENCES public.process_templates(id) ON DELETE SET NULL;