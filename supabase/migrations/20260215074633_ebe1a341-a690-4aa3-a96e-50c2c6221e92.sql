-- Add planner_labels column to tasks table (array of label strings)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS planner_labels text[] DEFAULT '{}';

-- Add index for filtering by planner labels
CREATE INDEX IF NOT EXISTS idx_tasks_planner_labels ON public.tasks USING GIN(planner_labels);
