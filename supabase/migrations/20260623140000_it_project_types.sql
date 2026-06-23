-- =========================================================================
-- Types de projet IT paramétrables (ajout/modification via Paramètres FDR)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.it_project_types (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value      text NOT NULL UNIQUE,          -- slug stocké dans it_projects.type_projet
  label      text NOT NULL,
  icon       text NOT NULL DEFAULT '📦',
  ordre      int  NOT NULL DEFAULT 0,
  actif      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.it_project_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_types_select_auth" ON public.it_project_types
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "project_types_insert_auth" ON public.it_project_types
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "project_types_update_auth" ON public.it_project_types
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "project_types_delete_auth" ON public.it_project_types
  FOR DELETE USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE public.it_project_types IS
  'Types de projet IT paramétrables (valeur stockée dans it_projects.type_projet).';

-- Seed des types historiques (idempotent)
INSERT INTO public.it_project_types (value, label, icon, ordre) VALUES
  ('infrastructure', 'Infrastructure', '🖧', 1),
  ('applicatif',     'Applicatif',     '💻', 2),
  ('securite',       'Sécurité',       '🔒', 3),
  ('data',           'Data / BI',      '📊', 4),
  ('integration',    'Intégration',    '🔗', 5),
  ('organisation',   'Organisation',   '🏛️', 6),
  ('ie',             'IE',             '🧠', 7),
  ('autre',          'Autre',          '📦', 99)
ON CONFLICT (value) DO NOTHING;
