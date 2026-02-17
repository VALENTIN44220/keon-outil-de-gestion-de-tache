
-- Add default fields for Planner import mapping
ALTER TABLE public.planner_plan_mappings 
  ADD COLUMN default_reporter_id uuid REFERENCES public.profiles(id),
  ADD COLUMN default_priority text DEFAULT 'medium',
  ADD COLUMN default_status text DEFAULT NULL;
