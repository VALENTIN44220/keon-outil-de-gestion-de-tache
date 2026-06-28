-- ============================================================
-- IT ROI — Référentiel TJM + Profils RH hors service IT
-- ============================================================

-- ── 1. Référentiel TJM par profil FDR (sensible — admin only) ─────────────

CREATE TABLE IF NOT EXISTS public.it_tjm_referentiel (
  profil_code TEXT PRIMARY KEY,
  tjm_eur     NUMERIC(10, 2) NOT NULL DEFAULT 0,
  description TEXT,
  updated_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.it_tjm_referentiel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "it_tjm_referentiel_select"
  ON public.it_tjm_referentiel FOR SELECT
  USING (true);

CREATE POLICY "it_tjm_referentiel_admin_write"
  ON public.it_tjm_referentiel FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'::app_role
    )
  );

-- ── 2. Profils RH hors service IT par projet ──────────────────────────────
--
-- Chaque ligne peut représenter :
--   a) Un profil qui participe au BUILD (coût one-shot) : j_build × tjm_interne
--   b) Un profil dont on attend des économies ETP post-déploiement (gain annuel)
--      → jours_an × tjm_interne   OU   jours_par_spv × nb_spv × tjm_interne
-- Un profil peut avoir les deux renseignés (ex : chef de projet métier).

CREATE TABLE IF NOT EXISTS public.it_project_rh_hors_it (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  it_project_id   UUID NOT NULL REFERENCES public.it_projects(id) ON DELETE CASCADE,
  profil_label    TEXT NOT NULL,
  -- Charge BUILD (one-shot, ajoutée au coût RH dans le ROI)
  j_build         NUMERIC(10, 2),
  -- Économies ETP annuelles post-déploiement (gain récurrent)
  unite           TEXT NOT NULL DEFAULT 'jours_an'
                    CHECK (unite IN ('jours_an', 'jours_spv')),
  jours_an        NUMERIC(10, 2),   -- si unite = 'jours_an'
  jours_par_spv   NUMERIC(10, 2),   -- si unite = 'jours_spv'
  nb_spv          INTEGER,           -- si unite = 'jours_spv'
  -- TJM interne (€/j) utilisé pour valoriser les deux composantes
  tjm_interne     NUMERIC(10, 2) NOT NULL DEFAULT 0,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.it_project_rh_hors_it ENABLE ROW LEVEL SECURITY;

-- Accès réservé aux utilisateurs authentifiés (lecture + écriture pleine).
CREATE POLICY "it_project_rh_hors_it_select"
  ON public.it_project_rh_hors_it FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "it_project_rh_hors_it_insert"
  ON public.it_project_rh_hors_it FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "it_project_rh_hors_it_update"
  ON public.it_project_rh_hors_it FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "it_project_rh_hors_it_delete"
  ON public.it_project_rh_hors_it FOR DELETE
  TO authenticated USING (true);

-- Trigger updated_at (CREATE OR REPLACE — idempotent si la fonction existe déjà)
CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS it_project_rh_hors_it_updated_at ON public.it_project_rh_hors_it;
CREATE TRIGGER it_project_rh_hors_it_updated_at
  BEFORE UPDATE ON public.it_project_rh_hors_it
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS it_tjm_referentiel_updated_at ON public.it_tjm_referentiel;
CREATE TRIGGER it_tjm_referentiel_updated_at
  BEFORE UPDATE ON public.it_tjm_referentiel
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
