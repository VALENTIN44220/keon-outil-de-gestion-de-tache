-- =========================================================================
-- Activités métier paramétrables (ajout/modification via Paramètres FDR)
-- La valeur stockée dans it_projects.activite_metier est le libellé lui-même
-- (chaînes historiques en majuscules) → value = libellé pour préserver
-- la correspondance avec les projets existants.
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.it_activites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  libelle    text NOT NULL UNIQUE,           -- valeur stockée dans it_projects.activite_metier
  ordre      int  NOT NULL DEFAULT 0,
  actif      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.it_activites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "it_activites_select_auth" ON public.it_activites
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "it_activites_insert_auth" ON public.it_activites
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "it_activites_update_auth" ON public.it_activites
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "it_activites_delete_auth" ON public.it_activites
  FOR DELETE USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE public.it_activites IS
  'Activités métier paramétrables (valeur stockée dans it_projects.activite_metier).';

-- Seed des activités historiques (idempotent)
INSERT INTO public.it_activites (libelle, ordre) VALUES
  ('EXPLOITATION',            1),
  ('BUREAU D''ETUDES',        2),
  ('IT/DIGITAL',             3),
  ('COMPTA/FINANCE',          4),
  ('COMMERCE',                5),
  ('JURIDIQUE / ACHAT',       6),
  ('RH',                      7),
  ('DEVELOPPEMENT',           8),
  ('COM/MARKETING',           9),
  ('DIRECTION / GOUVERNANCE', 10),
  ('INNOVATION',              11),
  ('TEIKEI',                  12),
  ('SYCOMORE',                13),
  ('TOUS',                    99)
ON CONFLICT (libelle) DO NOTHING;
