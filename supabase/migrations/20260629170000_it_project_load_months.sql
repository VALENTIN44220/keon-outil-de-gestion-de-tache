-- =========================================================================
-- Charge build mensuelle par profil (détail optionnel).
--
-- it_project_load garde le j/mois UNIFORME (mode simple = raccourci).
-- it_project_load_months stocke le détail mois par mois quand on veut faire
-- varier la charge d'un mois sur l'autre et/ou décaler le démarrage d'un profil.
-- Un profil est « détaillé » dès qu'il a ≥ 1 ligne ici : le moteur utilise alors
-- ces valeurs mensuelles (0 implicite = pas encore démarré) au lieu du j/mois.
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.it_project_load_months (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  it_project_id uuid NOT NULL REFERENCES public.it_projects(id) ON DELETE CASCADE,
  profil_id     uuid NOT NULL REFERENCES public.fdr_profils(id) ON DELETE CASCADE,
  ym            text NOT NULL,                 -- 'YYYY-MM'
  j_mois        numeric NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (it_project_id, profil_id, ym)
);

CREATE INDEX IF NOT EXISTS idx_it_project_load_months_project
  ON public.it_project_load_months(it_project_id);

ALTER TABLE public.it_project_load_months ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "it_plm_select_auth" ON public.it_project_load_months;
DROP POLICY IF EXISTS "it_plm_insert_auth" ON public.it_project_load_months;
DROP POLICY IF EXISTS "it_plm_update_auth" ON public.it_project_load_months;
DROP POLICY IF EXISTS "it_plm_delete_auth" ON public.it_project_load_months;
CREATE POLICY "it_plm_select_auth" ON public.it_project_load_months FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "it_plm_insert_auth" ON public.it_project_load_months FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "it_plm_update_auth" ON public.it_project_load_months FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "it_plm_delete_auth" ON public.it_project_load_months FOR DELETE USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE public.it_project_load_months IS
  'Détail mensuel optionnel de la charge build par profil (override du j/mois uniforme de it_project_load).';
