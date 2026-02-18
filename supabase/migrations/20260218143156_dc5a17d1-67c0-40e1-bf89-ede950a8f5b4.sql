
-- Add recurrence columns to process_templates
ALTER TABLE public.process_templates
  ADD COLUMN IF NOT EXISTS recurrence_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recurrence_unit TEXT DEFAULT NULL CHECK (recurrence_unit IN ('days', 'weeks', 'months', 'years')),
  ADD COLUMN IF NOT EXISTS recurrence_delay_days INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recurrence_start_date DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recurrence_next_run_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Table to track each recurrence execution
CREATE TABLE IF NOT EXISTS public.recurrence_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_template_id UUID NOT NULL REFERENCES public.process_templates(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'skipped')),
  error_message TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookup of next runs
CREATE INDEX IF NOT EXISTS idx_process_templates_recurrence_next ON public.process_templates (recurrence_next_run_at)
  WHERE recurrence_enabled = true AND recurrence_next_run_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recurrence_runs_process ON public.recurrence_runs (process_template_id, scheduled_at DESC);

-- RLS for recurrence_runs
ALTER TABLE public.recurrence_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage recurrence_runs"
  ON public.recurrence_runs
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view recurrence_runs for their templates"
  ON public.recurrence_runs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.process_templates pt
      WHERE pt.id = recurrence_runs.process_template_id
      AND public.can_view_template(pt.visibility_level, pt.user_id, pt.creator_company_id, pt.creator_department_id, 'process', pt.id)
    )
  );

-- Function to compute next run date
CREATE OR REPLACE FUNCTION public.compute_next_recurrence(
  p_current TIMESTAMP WITH TIME ZONE,
  p_interval INTEGER,
  p_unit TEXT
) RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_unit
    WHEN 'days' THEN p_current + (p_interval || ' days')::INTERVAL
    WHEN 'weeks' THEN p_current + (p_interval || ' weeks')::INTERVAL
    WHEN 'months' THEN p_current + (p_interval || ' months')::INTERVAL
    WHEN 'years' THEN p_current + (p_interval || ' years')::INTERVAL
  END
$$;
