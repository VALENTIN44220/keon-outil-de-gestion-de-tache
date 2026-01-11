-- Add type field to tasks table
ALTER TABLE public.tasks 
ADD COLUMN type text NOT NULL DEFAULT 'task' CHECK (type IN ('task', 'request'));

-- Add target_department_id for requests assigned to a department
ALTER TABLE public.tasks 
ADD COLUMN target_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

-- Create assignment_rules table for auto-routing
CREATE TABLE public.assignment_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  subcategory_id uuid REFERENCES public.subcategories(id) ON DELETE SET NULL,
  -- Target can be either a department (manager routes) or a specific person
  target_department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  target_assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Priority for when multiple rules could match
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.assignment_rules ENABLE ROW LEVEL SECURITY;

-- Only admins can manage assignment rules
CREATE POLICY "Admins can manage assignment_rules"
  ON public.assignment_rules
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Everyone can view active rules (needed for auto-assignment)
CREATE POLICY "Everyone can view active assignment_rules"
  ON public.assignment_rules
  FOR SELECT
  USING (is_active = true);

-- Update RLS on tasks to allow viewing tasks assigned to user's department
CREATE POLICY "Users can view requests for their department"
  ON public.tasks
  FOR SELECT
  USING (
    type = 'request' AND 
    target_department_id IN (
      SELECT department_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Allow managers to update requests for their department
CREATE POLICY "Users can update requests for their department"
  ON public.tasks
  FOR UPDATE
  USING (
    type = 'request' AND 
    target_department_id IN (
      SELECT department_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Users can view tasks assigned to them
CREATE POLICY "Users can view tasks assigned to them"
  ON public.tasks
  FOR SELECT
  USING (assignee_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Users can update tasks assigned to them
CREATE POLICY "Users can update tasks assigned to them"
  ON public.tasks
  FOR UPDATE
  USING (assignee_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_assignment_rules_updated_at
  BEFORE UPDATE ON public.assignment_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();