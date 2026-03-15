
CREATE TABLE public.it_project_phase_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  it_project_id UUID NOT NULL REFERENCES public.it_projects(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  advancement_mode TEXT NOT NULL DEFAULT 'auto',
  manual_progress INTEGER DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(it_project_id, phase)
);

ALTER TABLE public.it_project_phase_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage phase progress"
  ON public.it_project_phase_progress
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
