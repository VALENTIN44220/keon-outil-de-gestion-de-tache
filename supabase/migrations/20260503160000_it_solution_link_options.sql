-- =========================================================================
-- IT Cartographie — Options extensibles pour les liens
-- =========================================================================
-- Permet aux utilisateurs d'ajouter de nouvelles valeurs personnalisees
-- pour les champs type_flux / protocole / frequence du dialogue de
-- caracterisation d'un lien entre solutions.
--
-- 1) Drop du CHECK sur it_solution_links.type_flux pour autoriser n'importe
--    quelle valeur texte.
-- 2) Nouvelle table it_solution_link_options qui stocke les valeurs ajoutees
--    a la volee, partagees entre utilisateurs (RLS auth-only).
-- =========================================================================

-- 1) Lever la contrainte de validation pour type_flux
ALTER TABLE public.it_solution_links
  DROP CONSTRAINT IF EXISTS it_solution_links_type_flux_check;

-- (par precaution selon le nommage genere par PG)
DO $$
DECLARE
  cn TEXT;
BEGIN
  FOR cn IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.it_solution_links'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%type_flux%'
  LOOP
    EXECUTE format('ALTER TABLE public.it_solution_links DROP CONSTRAINT IF EXISTS %I', cn);
  END LOOP;
END $$;

-- 2) Table d'options partagees
CREATE TABLE IF NOT EXISTS public.it_solution_link_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_type TEXT NOT NULL
    CHECK (option_type IN ('type_flux', 'protocole', 'frequence')),
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_it_solution_link_options
  ON public.it_solution_link_options (option_type, value);

CREATE INDEX IF NOT EXISTS idx_it_solution_link_options_type
  ON public.it_solution_link_options (option_type);

ALTER TABLE public.it_solution_link_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users can read IT solution link options"
  ON public.it_solution_link_options;
CREATE POLICY "Auth users can read IT solution link options"
  ON public.it_solution_link_options FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth users can insert IT solution link options"
  ON public.it_solution_link_options;
CREATE POLICY "Auth users can insert IT solution link options"
  ON public.it_solution_link_options FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Creator can delete IT solution link options"
  ON public.it_solution_link_options;
CREATE POLICY "Creator can delete IT solution link options"
  ON public.it_solution_link_options FOR DELETE USING (auth.uid() = created_by);

COMMENT ON TABLE public.it_solution_link_options IS
  'Valeurs personnalisees (dropdowns addables) pour type_flux / protocole / frequence des liens entre solutions IT.';
