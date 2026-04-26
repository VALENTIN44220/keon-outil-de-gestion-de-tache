-- =========================================================================
-- IT Cartographie — Liens entre solutions
-- =========================================================================
-- Permet de modéliser les flux/dépendances entre solutions IT (ex: ERP ->
-- Datalake, TMS <-> ERP, KIONECT -> automates...) avec une caractérisation
-- riche : type de flux, direction, protocole, fréquence, criticité.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.it_solution_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_solution_id UUID NOT NULL REFERENCES public.it_solutions(id) ON DELETE CASCADE,
  target_solution_id UUID NOT NULL REFERENCES public.it_solutions(id) ON DELETE CASCADE,
  -- Type de flux principal
  type_flux TEXT
    CHECK (type_flux IS NULL OR type_flux IN (
      'data',          -- échange de données (ETL, sync)
      'integration',   -- intégration applicative (API, webhook)
      'fonctionnel',   -- dépendance fonctionnelle / métier
      'technique',     -- dépendance technique (auth, infra)
      'fichier',       -- échange par fichier (CSV, SFTP)
      'autre'
    )),
  direction TEXT
    NOT NULL DEFAULT 'source_to_target'
    CHECK (direction IN ('source_to_target', 'target_to_source', 'bidirectionnel')),
  protocole TEXT,                 -- texte libre : 'REST API', 'SFTP', 'JDBC', 'fichier CSV'...
  frequence TEXT,                 -- texte libre : 'temps réel', 'quotidien', 'hebdo', 'mensuel'...
  criticite TEXT
    CHECK (criticite IS NULL OR criticite IN ('faible', 'moyenne', 'forte', 'tres_forte')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Empêche les doublons exacts source->target (mais autorise A->B et B->A
  -- séparés, qu'on convertit volontairement en bidirectionnel via UPDATE)
  CONSTRAINT it_solution_links_no_self_loop CHECK (source_solution_id <> target_solution_id),
  CONSTRAINT it_solution_links_unique UNIQUE (source_solution_id, target_solution_id)
);

CREATE INDEX IF NOT EXISTS idx_it_solution_links_source ON public.it_solution_links (source_solution_id);
CREATE INDEX IF NOT EXISTS idx_it_solution_links_target ON public.it_solution_links (target_solution_id);

CREATE OR REPLACE FUNCTION public.set_updated_at_it_solution_links()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS tr_it_solution_links_updated_at ON public.it_solution_links;
CREATE TRIGGER tr_it_solution_links_updated_at
  BEFORE UPDATE ON public.it_solution_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_it_solution_links();

ALTER TABLE public.it_solution_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users can read IT solution links" ON public.it_solution_links;
CREATE POLICY "Auth users can read IT solution links"
  ON public.it_solution_links FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth users can insert IT solution links" ON public.it_solution_links;
CREATE POLICY "Auth users can insert IT solution links"
  ON public.it_solution_links FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth users can update IT solution links" ON public.it_solution_links;
CREATE POLICY "Auth users can update IT solution links"
  ON public.it_solution_links FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth users can delete IT solution links" ON public.it_solution_links;
CREATE POLICY "Auth users can delete IT solution links"
  ON public.it_solution_links FOR DELETE USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE public.it_solution_links IS
  'Liens caractérisés entre solutions IT pour la cartographie (flux, intégration, dépendance, etc.).';
