-- =====================================================================
-- Questionnaire — administration globale (sections / sous-sections / champs)
-- 001 : permission dédiée + tables d'ordre des sections & sous-sections
--
-- Contexte : les sections / sous-sections du questionnaire SPV sont de
-- simples colonnes texte portées par questionnaire_field_definitions
-- (structure 100 % globale, partagée par tous les projets). Jusqu'ici
-- l'ordre des sections était stocké en localStorage par utilisateur ET par
-- projet -> il fallait refaire la manip sur chaque projet. On persiste
-- désormais cet ordre en base, une seule fois pour TOUTES les SPV.
--
-- Additif et idempotent : ne supprime aucune donnée existante.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Permission dédiée « gérer la structure des questionnaires »
--    (niveau profil + surcharge utilisateur). Distincte de
--    can_edit_spv_data (qui ne pilote que la SAISIE de valeurs).
-- ---------------------------------------------------------------------
ALTER TABLE public.permission_profiles
  ADD COLUMN IF NOT EXISTS can_manage_questionnaire boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_permission_overrides
  ADD COLUMN IF NOT EXISTS can_manage_questionnaire boolean;

-- Helper : permission EFFECTIVE (surcharge utilisateur sinon profil),
-- les admins l'ont toujours. Réutilisé par les policies RLS.
CREATE OR REPLACE FUNCTION public.can_manage_questionnaire(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    has_role(_uid, 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      LEFT JOIN public.permission_profiles pp ON pp.id = p.permission_profile_id
      LEFT JOIN public.user_permission_overrides uo ON uo.user_id = p.id
      WHERE p.user_id = _uid
        AND COALESCE(uo.can_manage_questionnaire, pp.can_manage_questionnaire, false) = true
    );
$$;

-- ---------------------------------------------------------------------
-- 2. Table d'ordre des sections (1 ligne = 1 section d'un pilier)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.questionnaire_sections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilier_code   TEXT NOT NULL,
  section       TEXT NOT NULL,
  label         TEXT,
  order_index   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pilier_code, section)
);

-- ---------------------------------------------------------------------
-- 3. Table d'ordre des sous-sections (explicite et prévisible)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.questionnaire_sous_sections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilier_code   TEXT NOT NULL,
  section       TEXT NOT NULL,
  sous_section  TEXT NOT NULL,
  order_index   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pilier_code, section, sous_section)
);

CREATE INDEX IF NOT EXISTS idx_qst_sections_pilier ON public.questionnaire_sections (pilier_code, order_index);
CREATE INDEX IF NOT EXISTS idx_qst_sous_sections_pilier ON public.questionnaire_sous_sections (pilier_code, section, order_index);

-- ---------------------------------------------------------------------
-- 4. Seed : initialiser l'ordre à partir des champs existants
--    (zéro régression visuelle). Idempotent via ON CONFLICT DO NOTHING.
-- ---------------------------------------------------------------------

-- 4a. Sections — ordre générique = min(order_index) des champs de la section
INSERT INTO public.questionnaire_sections (pilier_code, section, order_index)
SELECT
  fd.pilier_code,
  fd.section,
  (ROW_NUMBER() OVER (PARTITION BY fd.pilier_code ORDER BY MIN(fd.order_index), fd.section) * 10)::int
FROM public.questionnaire_field_definitions fd
WHERE fd.is_active = true
GROUP BY fd.pilier_code, fd.section
ON CONFLICT (pilier_code, section) DO NOTHING;

-- 4b. Sous-sections — ordre = min(order_index) des champs de la sous-section
INSERT INTO public.questionnaire_sous_sections (pilier_code, section, sous_section, order_index)
SELECT
  fd.pilier_code,
  fd.section,
  fd.sous_section,
  (ROW_NUMBER() OVER (PARTITION BY fd.pilier_code, fd.section ORDER BY MIN(fd.order_index), fd.sous_section) * 10)::int
FROM public.questionnaire_field_definitions fd
WHERE fd.is_active = true
  AND fd.sous_section IS NOT NULL
  AND fd.sous_section <> ''
GROUP BY fd.pilier_code, fd.section, fd.sous_section
ON CONFLICT (pilier_code, section, sous_section) DO NOTHING;

-- 4c. Ordre canonique SPV (pilier 02) — aligne la base sur l'ordre
--     historiquement codé en dur côté front (useQuestionnaireSectionOrder).
UPDATE public.questionnaire_sections s SET order_index = v.ord
FROM (VALUES
  ('GENERALITES', 10),
  ('TABLE DE CAPI ET CCA', 20),
  ('STRUCTURATION JURIDIQUE', 30),
  ('GOUVERNANCE', 40),
  ('GESTION ADMINISTRATIVE ET FINANCIERE', 50),
  ('GESTION DES RESSOURCES HUMAINES', 60),
  ('GESTION DE L''IT', 70)
) AS v(section, ord)
WHERE s.pilier_code = '02' AND s.section = v.section;

-- ---------------------------------------------------------------------
-- 5. RLS — lecture pour tous, écriture réservée à can_manage_questionnaire
-- ---------------------------------------------------------------------
ALTER TABLE public.questionnaire_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_sous_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qst_sections_select ON public.questionnaire_sections;
DROP POLICY IF EXISTS qst_sections_write  ON public.questionnaire_sections;
DROP POLICY IF EXISTS qst_sous_sections_select ON public.questionnaire_sous_sections;
DROP POLICY IF EXISTS qst_sous_sections_write  ON public.questionnaire_sous_sections;

CREATE POLICY qst_sections_select ON public.questionnaire_sections
  FOR SELECT TO authenticated USING (true);

CREATE POLICY qst_sections_write ON public.questionnaire_sections
  FOR ALL TO authenticated
  USING (public.can_manage_questionnaire(auth.uid()))
  WITH CHECK (public.can_manage_questionnaire(auth.uid()));

CREATE POLICY qst_sous_sections_select ON public.questionnaire_sous_sections
  FOR SELECT TO authenticated USING (true);

CREATE POLICY qst_sous_sections_write ON public.questionnaire_sous_sections
  FOR ALL TO authenticated
  USING (public.can_manage_questionnaire(auth.uid()))
  WITH CHECK (public.can_manage_questionnaire(auth.uid()));
