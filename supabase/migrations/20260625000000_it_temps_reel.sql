-- ============================================================================
-- IT — Rapprochement des RH dépensées (temps réel) par projet
-- ============================================================================
-- Deux sources de temps réel pour un projet IT :
--   Mode A : déclarations Lucca (lucca_saisie_temps) rapprochées par code_site
--            via une table de correspondance projet IT ↔ codes Lucca.
--   Mode B : saisie manuelle (projets génériques / temps non imputé à un code).
--
-- Valorisation : on réutilise be_tjm_fonctions (taux horaire €/h par fonction
-- Lucca = profiles.job_title, repli profiles.be_fonction) — même logique que le SPV.
--   cout_rh = heures * COALESCE(fn.taux_horaire, fm.taux_horaire, 0)
-- ============================================================================

-- 1. Mode A — table de correspondance projet IT ↔ codes d'imputation Lucca
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.it_project_lucca_codes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  it_project_id UUID        NOT NULL REFERENCES public.it_projects(id) ON DELETE CASCADE,
  code_site     TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (it_project_id, code_site)
);

CREATE INDEX IF NOT EXISTS idx_it_project_lucca_codes_project ON public.it_project_lucca_codes(it_project_id);
CREATE INDEX IF NOT EXISTS idx_it_project_lucca_codes_code    ON public.it_project_lucca_codes(code_site);

COMMENT ON TABLE public.it_project_lucca_codes IS
  'Correspondance projet IT ↔ code(s) analytique(s) Lucca (lucca_saisie_temps.code_site). '
  'Permet de rapprocher les temps déclarés par code projet, comme le BE avec code_affaire.';

ALTER TABLE public.it_project_lucca_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read it_project_lucca_codes"
  ON public.it_project_lucca_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert it_project_lucca_codes"
  ON public.it_project_lucca_codes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update it_project_lucca_codes"
  ON public.it_project_lucca_codes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete it_project_lucca_codes"
  ON public.it_project_lucca_codes FOR DELETE TO authenticated USING (true);

-- 2. Mode B — saisie manuelle (projets génériques)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.it_project_temps_manuel (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  it_project_id UUID          NOT NULL REFERENCES public.it_projects(id) ON DELETE CASCADE,
  user_id       UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  profil_label  TEXT,
  mois          DATE,
  jours         NUMERIC(10,2) NOT NULL DEFAULT 0,
  note          TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_it_project_temps_manuel_project ON public.it_project_temps_manuel(it_project_id);

COMMENT ON TABLE public.it_project_temps_manuel IS
  'Répartition manuelle du temps déclaré pour les projets génériques (non rattachés '
  'à un code Lucca). Valorisé via le TJM par fonction de la personne si renseignée.';

CREATE TRIGGER update_it_project_temps_manuel_updated_at
  BEFORE UPDATE ON public.it_project_temps_manuel
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.it_project_temps_manuel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read it_project_temps_manuel"
  ON public.it_project_temps_manuel FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert it_project_temps_manuel"
  ON public.it_project_temps_manuel FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update it_project_temps_manuel"
  ON public.it_project_temps_manuel FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete it_project_temps_manuel"
  ON public.it_project_temps_manuel FOR DELETE TO authenticated USING (true);

-- 3. Vue agrégée — temps réel par projet / collaborateur / mois / source
-- ============================================================================
CREATE OR REPLACE VIEW public.v_it_project_temps_reel AS
WITH lucca AS (
  SELECT
    m.it_project_id,
    t.user_id,
    COALESCE(p.display_name, '—')                AS collaborateur,
    date_trunc('month', t.date_saisie)::date     AS mois,
    'lucca'::text                                AS source,
    SUM(t.duree_heures / 8.0)                     AS jours,
    SUM(t.duree_heures
        * COALESCE(fn.taux_horaire, fm.taux_horaire, 0)) AS cout_rh
  FROM public.it_project_lucca_codes m
  JOIN public.lucca_saisie_temps t  ON t.code_site = m.code_site
  LEFT JOIN public.profiles p           ON p.id        = t.user_id
  LEFT JOIN public.be_tjm_fonctions fn  ON fn.fonction = p.job_title
  LEFT JOIN public.be_tjm_fonctions fm  ON fm.fonction = p.be_fonction
  GROUP BY m.it_project_id, t.user_id, p.display_name, date_trunc('month', t.date_saisie)
),
manuel AS (
  SELECT
    tm.it_project_id,
    tm.user_id,
    COALESCE(p.display_name, tm.profil_label, '—') AS collaborateur,
    tm.mois,
    'manuel'::text                                 AS source,
    tm.jours                                       AS jours,
    tm.jours * 8.0
      * COALESCE(fn.taux_horaire, fm.taux_horaire, 0) AS cout_rh
  FROM public.it_project_temps_manuel tm
  LEFT JOIN public.profiles p           ON p.id        = tm.user_id
  LEFT JOIN public.be_tjm_fonctions fn  ON fn.fonction = p.job_title
  LEFT JOIN public.be_tjm_fonctions fm  ON fm.fonction = p.be_fonction
)
SELECT it_project_id, user_id, collaborateur, mois, source, jours, cout_rh FROM lucca
UNION ALL
SELECT it_project_id, user_id, collaborateur, mois, source, jours, cout_rh FROM manuel;

COMMENT ON VIEW public.v_it_project_temps_reel IS
  'Temps réel dépensé par projet IT : Lucca rapproché (code_site) + saisie manuelle. '
  'Valorisation cout_rh via be_tjm_fonctions (job_title/be_fonction) puis be_tjm_referentiel/8.';

GRANT SELECT ON public.v_it_project_temps_reel TO authenticated;
