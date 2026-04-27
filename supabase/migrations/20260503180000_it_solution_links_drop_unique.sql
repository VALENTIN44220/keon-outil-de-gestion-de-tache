-- =========================================================================
-- IT Cartographie — Plusieurs liens entre les memes solutions
-- =========================================================================
-- Le contrainte UNIQUE (source, target) empechait de creer un second lien
-- entre les memes nœuds, alors qu'on peut vouloir distinguer plusieurs
-- flux differents (ex: ERP -> Datalake en data quotidien + ERP -> Datalake
-- en fichier hebdomadaire). On lever cette contrainte.
-- =========================================================================

-- Drop le named constraint si present
ALTER TABLE public.it_solution_links
  DROP CONSTRAINT IF EXISTS it_solution_links_unique;

-- Drop tout autre UNIQUE (source, target) genere automatiquement le cas echeant
DO $$
DECLARE
  cn TEXT;
BEGIN
  FOR cn IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.it_solution_links'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%(source_solution_id, target_solution_id)%'
  LOOP
    EXECUTE format('ALTER TABLE public.it_solution_links DROP CONSTRAINT IF EXISTS %I', cn);
  END LOOP;
END $$;

COMMENT ON TABLE public.it_solution_links IS
  'Liens caracterises entre solutions IT. Plusieurs liens distincts entre la meme paire (source, target) sont autorises pour modeliser des flux differents (protocole, etat, frequence...).';
