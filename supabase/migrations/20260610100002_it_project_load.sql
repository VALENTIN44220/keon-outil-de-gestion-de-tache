-- Ventilation de la charge BUILD par profil et par projet.
-- La clé (it_project_id, profil_id) est unique : une seule ligne par couple.

CREATE TABLE IF NOT EXISTS public.it_project_load (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  it_project_id   UUID          NOT NULL REFERENCES public.it_projects(id) ON DELETE CASCADE,
  profil_id       UUID          NOT NULL REFERENCES public.fdr_profils(id) ON DELETE RESTRICT,
  j_mois          NUMERIC       NOT NULL DEFAULT 0
    CHECK (j_mois >= 0),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (it_project_id, profil_id)
);

CREATE INDEX IF NOT EXISTS it_project_load_project_idx ON public.it_project_load (it_project_id);

CREATE TRIGGER update_it_project_load_updated_at
  BEFORE UPDATE ON public.it_project_load
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.it_project_load ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read it_project_load"
  ON public.it_project_load FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert it_project_load"
  ON public.it_project_load FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update it_project_load"
  ON public.it_project_load FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete it_project_load"
  ON public.it_project_load FOR DELETE TO authenticated USING (true);
