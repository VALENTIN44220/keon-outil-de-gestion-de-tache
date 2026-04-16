-- Persist Planner sync diagnostics (skip counts, sample task) for troubleshooting "0 tasks" reports
ALTER TABLE public.planner_sync_logs
  ADD COLUMN IF NOT EXISTS diagnostics jsonb;
