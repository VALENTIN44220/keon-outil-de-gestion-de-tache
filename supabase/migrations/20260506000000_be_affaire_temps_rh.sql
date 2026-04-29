-- ============================================================================
-- BE - Suivi Temps & RH par affaire (F3)
-- ============================================================================
-- Modele :
--   be_affaires (1) ----< (N) be_affaire_temps_budget   (jours budgetes par poste)
--                  |
--                  +------< (N) tasks.be_affaire_id    (lien plan de charge)
--                  |              |
--                  |              +< (N) workload_slots (heures planifiees demi-journee)
--                  |
--                  +------< (N) lucca_saisie_temps     (heures declarees, jointure code_site)
--
--   profiles.be_poste --> be_tjm_referentiel.poste --> tjm
--
-- Vue d'agregation v_be_affaire_temps_kpi croise les 3 sources :
--   - jours_budgetes  (saisi dans l'app, par poste)
--   - jours_planifies (somme workload_slots des tasks liees)
--   - jours_declares  (somme heures Lucca / 8)
--   - cout_rh_budgete (jours_budgetes par poste x TJM du poste)
--   - cout_rh_declare (heures declarees x TJM(profiles.be_poste) / 8)
-- ============================================================================

-- 1. ENUM-like via CHECK : 5 postes BE + 'autre'
-- (on garde TEXT plutot que CREATE TYPE pour faciliter l'evolution)

-- 2. Colonne be_poste sur profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS be_poste TEXT;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_be_poste_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_be_poste_check
    CHECK (be_poste IS NULL OR be_poste IN (
      'charge_affaires',
      'developpeur',
      'ingenieur_etudes',
      'ingenieur_realisation',
      'projeteur',
      'autre'
    ));

COMMENT ON COLUMN public.profiles.be_poste IS
  'Poste BE pour la valorisation des temps Lucca (cout RH = heures x TJM(be_poste)). NULL si non-BE.';

-- 3. Referentiel TJM par poste BE
CREATE TABLE IF NOT EXISTS public.be_tjm_referentiel (
  poste       TEXT          PRIMARY KEY
                CHECK (poste IN (
                  'charge_affaires','developpeur','ingenieur_etudes',
                  'ingenieur_realisation','projeteur','autre'
                )),
  tjm         NUMERIC(10,2) NOT NULL CHECK (tjm >= 0),
  description TEXT,
  updated_by  UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.be_tjm_referentiel IS
  'TJM par poste BE. Saisi par admin BE depuis la page admin. Pas d''historique pour le MVP.';

ALTER TABLE public.be_tjm_referentiel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read be_tjm_referentiel"
  ON public.be_tjm_referentiel FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert be_tjm_referentiel"
  ON public.be_tjm_referentiel FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update be_tjm_referentiel"
  ON public.be_tjm_referentiel FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete be_tjm_referentiel"
  ON public.be_tjm_referentiel FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_be_tjm_referentiel_updated_at
  BEFORE UPDATE ON public.be_tjm_referentiel
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Pre-population avec valeurs par defaut (a ajuster ensuite cote admin)
INSERT INTO public.be_tjm_referentiel (poste, tjm, description) VALUES
  ('charge_affaires',       650, 'Chargé d''affaires - placeholder à ajuster'),
  ('ingenieur_etudes',      550, 'Ingénieur études - placeholder'),
  ('ingenieur_realisation', 600, 'Ingénieur réalisation - placeholder'),
  ('projeteur',             450, 'Projeteur - placeholder'),
  ('developpeur',           550, 'Développeur - placeholder'),
  ('autre',                 500, 'Autre poste BE - placeholder')
ON CONFLICT (poste) DO NOTHING;

-- 4. Temps budgete par affaire et par poste
CREATE TABLE IF NOT EXISTS public.be_affaire_temps_budget (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  be_affaire_id   UUID         NOT NULL REFERENCES public.be_affaires(id) ON DELETE CASCADE,
  poste           TEXT         NOT NULL
                    CHECK (poste IN (
                      'charge_affaires','developpeur','ingenieur_etudes',
                      'ingenieur_realisation','projeteur','autre'
                    )),
  jours_budgetes  NUMERIC(8,2) NOT NULL CHECK (jours_budgetes >= 0),
  commentaire     TEXT,
  created_by      UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT be_affaire_temps_budget_unique UNIQUE (be_affaire_id, poste)
);

CREATE INDEX IF NOT EXISTS idx_be_temps_budget_affaire ON public.be_affaire_temps_budget(be_affaire_id);

ALTER TABLE public.be_affaire_temps_budget ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read be_affaire_temps_budget"
  ON public.be_affaire_temps_budget FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert be_affaire_temps_budget"
  ON public.be_affaire_temps_budget FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update be_affaire_temps_budget"
  ON public.be_affaire_temps_budget FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete be_affaire_temps_budget"
  ON public.be_affaire_temps_budget FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_be_affaire_temps_budget_updated_at
  BEFORE UPDATE ON public.be_affaire_temps_budget
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Mirror Lucca - saisies de temps
CREATE TABLE IF NOT EXISTS public.lucca_saisie_temps (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id         TEXT         UNIQUE NOT NULL,                -- id Lucca de la saisie (idempotence)
  id_lucca            BIGINT       NOT NULL,                       -- id collaborateur Lucca
  user_id             UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
  /** Code analytique Lucca (= be_affaires.code_affaire). Cle de jointure. */
  code_site           TEXT         NOT NULL,
  date_saisie         DATE         NOT NULL,
  duree_heures        NUMERIC(5,2) NOT NULL CHECK (duree_heures >= 0),
  type_temps          TEXT,                                        -- 'productif','reunion','formation',...
  libelle             TEXT,
  validated_by_lucca  BOOLEAN      DEFAULT false,
  fabric_synced_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  raw                 JSONB,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lucca_temps_code_site ON public.lucca_saisie_temps(code_site);
CREATE INDEX IF NOT EXISTS idx_lucca_temps_user_id   ON public.lucca_saisie_temps(user_id);
CREATE INDEX IF NOT EXISTS idx_lucca_temps_date      ON public.lucca_saisie_temps(date_saisie);
CREATE INDEX IF NOT EXISTS idx_lucca_temps_id_lucca  ON public.lucca_saisie_temps(id_lucca);

ALTER TABLE public.lucca_saisie_temps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read lucca_saisie_temps"
  ON public.lucca_saisie_temps FOR SELECT TO authenticated USING (true);

-- Ecriture reservee au service_role (notebook Fabric).

CREATE TRIGGER update_lucca_saisie_temps_updated_at
  BEFORE UPDATE ON public.lucca_saisie_temps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Whitelist pour bulk-upsert
INSERT INTO public.datalake_table_catalog (table_name, display_name, description, sync_enabled)
VALUES (
  'lucca_saisie_temps',
  'Lucca - Saisies de temps',
  'Mirror Lucca des saisies de temps par collaborateur. Aliment via notebook Fabric, conflict_key = external_id. Joint sur be_affaires via code_site = code_affaire.',
  true
)
ON CONFLICT (table_name) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      description  = EXCLUDED.description,
      sync_enabled = EXCLUDED.sync_enabled,
      updated_at   = now();

-- 6. Lien plan de charge <-> affaire BE
-- be_affaire_id sur tasks (nullable, FK molle ON DELETE SET NULL pour preserver les tasks
-- si une affaire est supprimee).
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS be_affaire_id UUID REFERENCES public.be_affaires(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_be_affaire_id ON public.tasks(be_affaire_id);

COMMENT ON COLUMN public.tasks.be_affaire_id IS
  'Affaire BE liee a cette tache. Permet de valoriser le temps planifie (workload_slots) au niveau de l''affaire pour le suivi RH.';

-- 7. Vue d'agregation : jours budgetes / planifies / declares + couts RH
-- Note : conversion heures -> jours via 8h/j (constante), pourra etre parametre plus tard.
CREATE OR REPLACE VIEW public.v_be_affaire_temps_kpi AS
WITH temps_budgete AS (
  SELECT
    tb.be_affaire_id,
    SUM(tb.jours_budgetes) AS jours_budgetes_total,
    SUM(tb.jours_budgetes * COALESCE(tjm.tjm, 0)) AS cout_rh_budgete
  FROM public.be_affaire_temps_budget tb
  LEFT JOIN public.be_tjm_referentiel tjm ON tjm.poste = tb.poste
  GROUP BY tb.be_affaire_id
),
temps_planifie AS (
  SELECT
    t.be_affaire_id,
    SUM(ws.duration_hours) AS heures_planifiees,
    SUM(ws.duration_hours / 8.0) AS jours_planifies,
    SUM(ws.duration_hours / 8.0 * COALESCE(tjm.tjm, 0)) AS cout_rh_planifie
  FROM public.tasks t
  JOIN public.workload_slots ws ON ws.task_id = t.id
  LEFT JOIN public.profiles p ON p.id = ws.user_id
  LEFT JOIN public.be_tjm_referentiel tjm ON tjm.poste = p.be_poste
  WHERE t.be_affaire_id IS NOT NULL
  GROUP BY t.be_affaire_id
),
temps_declare AS (
  SELECT
    a.id AS be_affaire_id,
    SUM(t.duree_heures) AS heures_declarees,
    SUM(t.duree_heures / 8.0) AS jours_declares,
    SUM(t.duree_heures / 8.0 * COALESCE(tjm.tjm, 0)) AS cout_rh_declare
  FROM public.be_affaires a
  JOIN public.lucca_saisie_temps t ON t.code_site = a.code_affaire
  LEFT JOIN public.profiles p ON p.id = t.user_id
  LEFT JOIN public.be_tjm_referentiel tjm ON tjm.poste = p.be_poste
  GROUP BY a.id
)
SELECT
  a.id           AS be_affaire_id,
  a.be_project_id,
  a.code_affaire,
  COALESCE(tb.jours_budgetes_total, 0) AS jours_budgetes,
  COALESCE(tb.cout_rh_budgete,      0) AS cout_rh_budgete,
  COALESCE(tp.heures_planifiees,    0) AS heures_planifiees,
  COALESCE(tp.jours_planifies,      0) AS jours_planifies,
  COALESCE(tp.cout_rh_planifie,     0) AS cout_rh_planifie,
  COALESCE(td.heures_declarees,     0) AS heures_declarees,
  COALESCE(td.jours_declares,       0) AS jours_declares,
  COALESCE(td.cout_rh_declare,      0) AS cout_rh_declare
FROM public.be_affaires a
LEFT JOIN temps_budgete  tb ON tb.be_affaire_id = a.id
LEFT JOIN temps_planifie tp ON tp.be_affaire_id = a.id
LEFT JOIN temps_declare  td ON td.be_affaire_id = a.id;

COMMENT ON VIEW public.v_be_affaire_temps_kpi IS
  'KPI Temps & RH par affaire BE : jours budgetes (be_affaire_temps_budget) + planifies (workload_slots via tasks.be_affaire_id) + declares (lucca_saisie_temps via code_site). Couts RH = jours x TJM(profiles.be_poste).';
