-- Ajoute une colonne phases_actives sur it_projects pour permettre
-- de simplifier le nombre de phases d'un projet IT (sous-ensemble des
-- 5 phases standard : cadrage, analyse, developpement, recette, deploiement).
-- Par défaut, les 5 phases restent actives pour rester rétrocompatible
-- avec les projets existants.

ALTER TABLE public.it_projects
  ADD COLUMN IF NOT EXISTS phases_actives JSONB
    NOT NULL
    DEFAULT '["cadrage","analyse","developpement","recette","deploiement"]'::jsonb;

-- Backfill explicite pour les éventuelles lignes pré-existantes où la
-- valeur par défaut n'aurait pas été appliquée (no-op si déjà rempli).
UPDATE public.it_projects
SET phases_actives = '["cadrage","analyse","developpement","recette","deploiement"]'::jsonb
WHERE phases_actives IS NULL;
