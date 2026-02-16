
-- Add default requester and resolve_assignees flag to planner_plan_mappings
ALTER TABLE public.planner_plan_mappings 
  ADD COLUMN IF NOT EXISTS default_requester_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS resolve_assignees boolean NOT NULL DEFAULT true;

-- Add planner_user_email to planner_task_links for traceability
ALTER TABLE public.planner_task_links
  ADD COLUMN IF NOT EXISTS planner_assignee_email text,
  ADD COLUMN IF NOT EXISTS planner_assignee_name text;
