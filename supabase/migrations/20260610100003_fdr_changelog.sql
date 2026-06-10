-- Journal des modifications de la feuille de route.
-- Chaque manipulation Gantt (déplacement, redimensionnement, exclusion) est tracée.
-- Sert à la fois à l'audit CODIR et au mécanisme undo/redo côté client.

CREATE TABLE IF NOT EXISTS public.fdr_changelog (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  it_project_id   UUID          NOT NULL REFERENCES public.it_projects(id) ON DELETE CASCADE,
  user_id         UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- action : 'move' | 'resize' | 'remove_fdr' | 'restore_fdr' | 'change_status' | 'change_priority' | 'shift_months'
  action          TEXT          NOT NULL,
  field_changed   TEXT          NOT NULL,
  old_value       TEXT,
  new_value       TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fdr_changelog_project_idx ON public.fdr_changelog (it_project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS fdr_changelog_user_idx    ON public.fdr_changelog (user_id, created_at DESC);

ALTER TABLE public.fdr_changelog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read fdr_changelog"
  ON public.fdr_changelog FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert fdr_changelog"
  ON public.fdr_changelog FOR INSERT TO authenticated WITH CHECK (true);
