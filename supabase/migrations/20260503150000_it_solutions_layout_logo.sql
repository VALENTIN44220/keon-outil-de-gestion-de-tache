-- =========================================================================
-- IT Cartographie — Layout & logo
-- =========================================================================
-- Ajoute la persistance de la position / taille des nœuds dans le graphe
-- (drag + resize) et un champ logo_url pour afficher l'icône d'une solution.
-- =========================================================================

ALTER TABLE public.it_solutions
  ADD COLUMN IF NOT EXISTS position_x NUMERIC,
  ADD COLUMN IF NOT EXISTS position_y NUMERIC,
  ADD COLUMN IF NOT EXISTS width NUMERIC,
  ADD COLUMN IF NOT EXISTS height NUMERIC,
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN public.it_solutions.position_x IS
  'Position X (px) du nœud dans la vue graphe — mise à jour au drag.';
COMMENT ON COLUMN public.it_solutions.position_y IS
  'Position Y (px) du nœud dans la vue graphe — mise à jour au drag.';
COMMENT ON COLUMN public.it_solutions.width IS
  'Largeur (px) du nœud dans la vue graphe — mise à jour au resize.';
COMMENT ON COLUMN public.it_solutions.height IS
  'Hauteur (px) du nœud dans la vue graphe — mise à jour au resize.';
COMMENT ON COLUMN public.it_solutions.logo_url IS
  'URL d''un logo / icône représentant la solution. Affiché dans la card et le nœud du graphe.';
