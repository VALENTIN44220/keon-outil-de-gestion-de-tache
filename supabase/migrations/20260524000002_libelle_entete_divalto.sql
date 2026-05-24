-- Ajout colonne libelle_entete : libellé de l'entête de pièce (ent_gold)
-- Une pièce a un libellé global (entête) distinct des libellés de lignes analytiques (mouv_gold.des)
ALTER TABLE public.divalto_mouvements_all
  ADD COLUMN IF NOT EXISTS libelle_entete TEXT;

COMMENT ON COLUMN public.divalto_mouvements_all.libelle_entete IS
  'Libellé entête de la pièce (ent_gold.des), commun à toutes les lignes analytiques de la même pièce. Alimenté via join ent_gold sur prefpino+pino.';
