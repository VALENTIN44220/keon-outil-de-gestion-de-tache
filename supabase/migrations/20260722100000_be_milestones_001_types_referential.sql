-- BUG-00019 Lot 1 — Fondation jalons projet (appliquée en prod le 2026-07-22).
-- Référentiel des types de jalons + normalisation de be_project_milestones.

CREATE TABLE IF NOT EXISTS public.be_milestone_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  category text NOT NULL DEFAULT 'reglementaire', -- 'reglementaire' | 'projet'
  ordre integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.be_milestone_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read milestone types" ON public.be_milestone_types;
CREATE POLICY "read milestone types" ON public.be_milestone_types
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin manage milestone types" ON public.be_milestone_types;
CREATE POLICY "admin manage milestone types" ON public.be_milestone_types
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.be_project_milestones
  ADD COLUMN IF NOT EXISTS type_code text;
CREATE INDEX IF NOT EXISTS idx_be_project_milestones_type
  ON public.be_project_milestones (be_project_id, type_code);

INSERT INTO public.be_milestone_types (code, label, category, ordre) VALUES
  ('icpe_depot',        'ICPE — Dépôt',                'reglementaire', 10),
  ('icpe_completude',   'ICPE — Complétude',           'reglementaire', 20),
  ('icpe_arrete',       'ICPE — Arrêté / Récépissé',   'reglementaire', 30),
  ('icpe_purge',        'ICPE — Purge du recours',     'reglementaire', 40),
  ('pc_depot',          'PC — Dépôt',                  'reglementaire', 50),
  ('pc_completude',     'PC — Complétude',             'reglementaire', 60),
  ('pc_arrete',         'PC — Arrêté de PC',           'reglementaire', 70),
  ('pc_purge',          'PC — Purge du recours',       'reglementaire', 80),
  ('agrement_depot',    'Agrément sanitaire — Dépôt',  'reglementaire', 90),
  ('agrement_definitif','Agrément sanitaire — Définitif','reglementaire', 100),
  ('os_etude',          'OS Étude',                    'projet', 200),
  ('os_travaux',        'OS Travaux',                  'projet', 210),
  ('cloture_bancaire',  'Clôture bancaire',            'projet', 220),
  ('cloture_juridique', 'Clôture juridique',           'projet', 230),
  ('mise_en_service',   'Mise en service',             'projet', 240)
ON CONFLICT (code) DO UPDATE
  SET label = EXCLUDED.label, category = EXCLUDED.category, ordre = EXCLUDED.ordre;

UPDATE public.be_project_milestones SET type_code = 'icpe_completude'
  WHERE type_code IS NULL AND titre ILIKE '%complétude%';
UPDATE public.be_project_milestones SET type_code = 'icpe_depot'
  WHERE type_code IS NULL AND (titre ILIKE '%dépôt%' OR titre ILIKE '%récépissé%');
