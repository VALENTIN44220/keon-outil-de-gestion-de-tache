-- Lien N<->N entre les jalons de projet IT et les evenements du calendrier
-- Outlook. On stocke un snapshot (subject, start_time, end_time, location,
-- organizer_email) au moment du lien pour que le jalon affiche l'info meme
-- quand l'utilisateur courant n'a pas l'evenement dans son cache personnel
-- (outlook_calendar_events est cache par utilisateur).

CREATE TABLE IF NOT EXISTS public.it_milestone_calendar_links (
  id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  it_project_milestone_id  UUID         NOT NULL REFERENCES public.it_project_milestones(id) ON DELETE CASCADE,
  -- ID Microsoft stable de l'evenement Outlook
  outlook_event_id         TEXT         NOT NULL,
  -- Snapshot de l'evenement au moment du lien
  subject                  TEXT         NOT NULL,
  start_time               TIMESTAMPTZ  NOT NULL,
  end_time                 TIMESTAMPTZ  NOT NULL,
  location                 TEXT,
  organizer_email          TEXT,
  -- Audit
  created_by               UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (it_project_milestone_id, outlook_event_id)
);

CREATE INDEX IF NOT EXISTS idx_imcl_milestone
  ON public.it_milestone_calendar_links (it_project_milestone_id);
CREATE INDEX IF NOT EXISTS idx_imcl_event
  ON public.it_milestone_calendar_links (outlook_event_id);

ALTER TABLE public.it_milestone_calendar_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read milestone calendar links"
  ON public.it_milestone_calendar_links FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert milestone calendar links"
  ON public.it_milestone_calendar_links FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update milestone calendar links"
  ON public.it_milestone_calendar_links FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete milestone calendar links"
  ON public.it_milestone_calendar_links FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_it_milestone_calendar_links_updated_at
  BEFORE UPDATE ON public.it_milestone_calendar_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
