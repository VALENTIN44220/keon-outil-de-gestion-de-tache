-- Add recurrence columns to sub_process_templates
ALTER TABLE public.sub_process_templates
  ADD COLUMN IF NOT EXISTS recurrence_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recurrence_unit TEXT DEFAULT 'months',
  ADD COLUMN IF NOT EXISTS recurrence_delay_days INTEGER DEFAULT 7,
  ADD COLUMN IF NOT EXISTS recurrence_start_date DATE,
  ADD COLUMN IF NOT EXISTS recurrence_next_run_at TIMESTAMPTZ;

-- Also add sub_process_template_id to recurrence_runs for tracking sub-process level recurrences
ALTER TABLE public.recurrence_runs
  ADD COLUMN IF NOT EXISTS sub_process_template_id UUID REFERENCES public.sub_process_templates(id);