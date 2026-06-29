-- =========================================================================
-- Module « Suivi des bugs & demandes d'amélioration »
-- Tous les utilisateurs connectés soumettent/consultent ; le triage (statut /
-- priorité / assignation) est gardé côté UI (admin). RLS = auth.uid() IS NOT NULL
-- (même modèle de confiance que it_project_types).
-- =========================================================================

-- Référence lisible : BUG-00001, BUG-00002, …
CREATE SEQUENCE IF NOT EXISTS public.bug_reports_ref_seq;

CREATE OR REPLACE FUNCTION public.set_bug_report_ref()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.ref IS NULL THEN
    NEW.ref := 'BUG-' || lpad(nextval('public.bug_reports_ref_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- ---- Table principale ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bug_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref         text UNIQUE,
  title       text NOT NULL,
  description text,
  type        text NOT NULL DEFAULT 'bug' CHECK (type IN ('bug', 'amelioration')),
  priority    text NOT NULL DEFAULT 'normale' CHECK (priority IN ('basse', 'normale', 'haute', 'critique')),
  status      text NOT NULL DEFAULT 'nouveau' CHECK (status IN ('nouveau', 'en_cours', 'planifie', 'resolu', 'rejete', 'ferme')),
  page_url    text,
  user_agent  text,
  reported_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status   ON public.bug_reports(status)      WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bug_reports_type     ON public.bug_reports(type)        WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bug_reports_reporter ON public.bug_reports(reported_by) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bug_reports_assignee ON public.bug_reports(assigned_to) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_bug_reports_ref ON public.bug_reports;
CREATE TRIGGER trg_bug_reports_ref BEFORE INSERT ON public.bug_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_bug_report_ref();
DROP TRIGGER IF EXISTS trg_bug_reports_updated_at ON public.bug_reports;
CREATE TRIGGER trg_bug_reports_updated_at BEFORE UPDATE ON public.bug_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---- Commentaires (calque task_comments) --------------------------------
CREATE TABLE IF NOT EXISTS public.bug_report_comments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_report_id uuid NOT NULL REFERENCES public.bug_reports(id) ON DELETE CASCADE,
  author_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  content       text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bug_comments_report ON public.bug_report_comments(bug_report_id, created_at);

DROP TRIGGER IF EXISTS trg_bug_comments_updated_at ON public.bug_report_comments;
CREATE TRIGGER trg_bug_comments_updated_at BEFORE UPDATE ON public.bug_report_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---- Pièces jointes (calque nc_attachments) -----------------------------
CREATE TABLE IF NOT EXISTS public.bug_report_attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_report_id uuid NOT NULL REFERENCES public.bug_reports(id) ON DELETE CASCADE,
  name          text NOT NULL,
  url           text NOT NULL,
  storage_path  text,
  type          text,
  uploaded_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bug_attachments_report ON public.bug_report_attachments(bug_report_id);

-- ---- Historique de statut (calque nc_status_history) --------------------
CREATE TABLE IF NOT EXISTS public.bug_report_status_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_report_id uuid NOT NULL REFERENCES public.bug_reports(id) ON DELETE CASCADE,
  from_status   text,
  to_status     text NOT NULL,
  changed_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  comment       text,
  changed_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bug_history_report ON public.bug_report_status_history(bug_report_id, changed_at);

-- ---- RLS : authentifié = accès (contrôle fin admin côté UI) -------------
ALTER TABLE public.bug_reports               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_report_comments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_report_attachments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_report_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bug_reports_select_auth" ON public.bug_reports FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "bug_reports_insert_auth" ON public.bug_reports FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "bug_reports_update_auth" ON public.bug_reports FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "bug_reports_delete_auth" ON public.bug_reports FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "bug_comments_select_auth" ON public.bug_report_comments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "bug_comments_insert_auth" ON public.bug_report_comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "bug_comments_update_auth" ON public.bug_report_comments FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "bug_comments_delete_auth" ON public.bug_report_comments FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "bug_attachments_select_auth" ON public.bug_report_attachments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "bug_attachments_insert_auth" ON public.bug_report_attachments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "bug_attachments_delete_auth" ON public.bug_report_attachments FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "bug_history_select_auth" ON public.bug_report_status_history FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "bug_history_insert_auth" ON public.bug_report_status_history FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ---- Realtime ------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.bug_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bug_report_comments;

-- ---- Storage : bucket privé bug-attachments -----------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('bug-attachments', 'bug-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "bug_attachments_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'bug-attachments' AND auth.uid() IS NOT NULL);
CREATE POLICY "bug_attachments_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'bug-attachments' AND auth.uid() IS NOT NULL);
CREATE POLICY "bug_attachments_storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'bug-attachments' AND auth.uid() IS NOT NULL);

COMMENT ON TABLE public.bug_reports IS 'Tickets de suivi des bugs / demandes d''amélioration de l''application.';
