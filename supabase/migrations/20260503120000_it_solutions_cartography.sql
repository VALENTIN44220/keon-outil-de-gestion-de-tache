-- =========================================================================
-- IT — Cartographie des solutions
-- =========================================================================
-- Catalogue des solutions IT en place ou en cours chez KEON (ERP, TMS, SaaS,
-- modules métier, automates, plateformes data, applications internes...).
-- Chaque solution peut être reliée à un ou plusieurs projets IT (création,
-- évolution, migration, maintenance) via une table de jonction.
-- =========================================================================

-- ─── Table principale ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.it_solutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  -- Catégorie haut-niveau (ERP, TMS, SaaS, Plateforme data, Application
  -- métier, Module métier, Automatisme industriel, SIRH, Finance,
  -- Application interne, BI/Reporting, Sources externes, Autre)
  categorie TEXT,
  -- Type technique (Progiciel, SaaS, Système industriel, Plateforme interne,
  -- Données / interfaces externes, Outil de reporting, Développement interne,
  -- Module spécifique, Autre)
  type TEXT,
  usage_principal TEXT,
  domaine_metier TEXT,
  visible_dans_schema BOOLEAN NOT NULL DEFAULT TRUE,
  connecte_datalake TEXT
    CHECK (connecte_datalake IS NULL OR connecte_datalake IN ('oui', 'non', 'indirect', 'na')),
  flux_principaux TEXT,
  statut_temporalite TEXT,
  owner_metier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  owner_it_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  perimetre TEXT,
  criticite TEXT
    CHECK (criticite IS NULL OR criticite IN ('faible', 'moyenne', 'forte', 'tres_forte')),
  commentaires TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_it_solutions_categorie ON public.it_solutions (categorie);
CREATE INDEX IF NOT EXISTS idx_it_solutions_criticite ON public.it_solutions (criticite);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at_it_solutions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS tr_it_solutions_updated_at ON public.it_solutions;
CREATE TRIGGER tr_it_solutions_updated_at
  BEFORE UPDATE ON public.it_solutions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_it_solutions();

ALTER TABLE public.it_solutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users can read IT solutions" ON public.it_solutions;
CREATE POLICY "Auth users can read IT solutions"
  ON public.it_solutions FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth users can insert IT solutions" ON public.it_solutions;
CREATE POLICY "Auth users can insert IT solutions"
  ON public.it_solutions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth users can update IT solutions" ON public.it_solutions;
CREATE POLICY "Auth users can update IT solutions"
  ON public.it_solutions FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Creator can delete IT solutions" ON public.it_solutions;
CREATE POLICY "Creator can delete IT solutions"
  ON public.it_solutions FOR DELETE USING (auth.uid() = created_by);

COMMENT ON TABLE public.it_solutions IS
  'Cartographie des solutions IT en place chez KEON (ERP, CRM, applications métier, etc.).';

-- ─── Table de jonction solutions <-> projets ────────────────────────────
CREATE TABLE IF NOT EXISTS public.it_solution_projects (
  solution_id UUID NOT NULL REFERENCES public.it_solutions(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.it_projects(id) ON DELETE CASCADE,
  type_lien TEXT
    CHECK (type_lien IS NULL OR type_lien IN ('creation', 'evolution', 'migration', 'maintenance', 'decommissionnement', 'autre')),
  commentaire TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (solution_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_it_solution_projects_project_id
  ON public.it_solution_projects (project_id);

ALTER TABLE public.it_solution_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users can read IT solution projects" ON public.it_solution_projects;
CREATE POLICY "Auth users can read IT solution projects"
  ON public.it_solution_projects FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth users can insert IT solution projects" ON public.it_solution_projects;
CREATE POLICY "Auth users can insert IT solution projects"
  ON public.it_solution_projects FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth users can delete IT solution projects" ON public.it_solution_projects;
CREATE POLICY "Auth users can delete IT solution projects"
  ON public.it_solution_projects FOR DELETE USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE public.it_solution_projects IS
  'Jonction many-to-many entre solutions IT et projets (un projet peut faire évoluer plusieurs solutions, une solution peut être impactée par plusieurs projets).';
