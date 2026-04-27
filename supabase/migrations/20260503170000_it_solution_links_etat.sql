-- =========================================================================
-- IT Cartographie — Etat et date de mise en service des liens
-- =========================================================================
-- Ajoute deux champs sur les liens entre solutions :
--   - etat_flux  : cycle de vie du flux (a_creer / planifie / en_developpement
--                  / en_fonctionnement / en_evolution)
--   - date_mise_en_service : date de mise en production effective
-- =========================================================================

ALTER TABLE public.it_solution_links
  ADD COLUMN IF NOT EXISTS etat_flux TEXT
    CHECK (etat_flux IS NULL OR etat_flux IN (
      'a_creer',
      'planifie',
      'en_developpement',
      'en_fonctionnement',
      'en_evolution'
    )),
  ADD COLUMN IF NOT EXISTS date_mise_en_service DATE;

COMMENT ON COLUMN public.it_solution_links.etat_flux IS
  'Etat / cycle de vie du flux : a_creer, planifie, en_developpement, en_fonctionnement, en_evolution.';
COMMENT ON COLUMN public.it_solution_links.date_mise_en_service IS
  'Date de mise en service / production effective du flux.';
