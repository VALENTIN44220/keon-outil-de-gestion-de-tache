-- Unification des statuts projet IT.
-- statut_portefeuille (Idée / Proposition / En développement / Déployé /
-- Tâche permanente / Abandonné) devient la source de vérité unique.
-- L'ancien statut delivery (backlog / en_cours / ...) est conservé en colonne
-- pour compatibilité (requêtes, intégrations) mais dérivé automatiquement.

CREATE OR REPLACE FUNCTION public.derive_it_project_statut()
RETURNS TRIGGER AS $$
BEGIN
  NEW.statut := CASE NEW.statut_portefeuille
    WHEN 'Idée'              THEN 'backlog'
    WHEN 'Proposition'       THEN 'backlog'
    WHEN 'En développement'  THEN 'en_cours'
    WHEN 'Tâche permanente'  THEN 'en_cours'
    WHEN 'Déployé'           THEN 'deploye'
    WHEN 'Abandonné'         THEN 'cloture'
    ELSE COALESCE(NEW.statut, 'backlog')
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS derive_it_project_statut_trigger ON public.it_projects;
CREATE TRIGGER derive_it_project_statut_trigger
  BEFORE INSERT OR UPDATE OF statut_portefeuille ON public.it_projects
  FOR EACH ROW EXECUTE FUNCTION public.derive_it_project_statut();

-- Backfill : aligne le statut delivery existant sur le portefeuille
UPDATE public.it_projects SET statut = CASE statut_portefeuille
  WHEN 'Idée'              THEN 'backlog'
  WHEN 'Proposition'       THEN 'backlog'
  WHEN 'En développement'  THEN 'en_cours'
  WHEN 'Tâche permanente'  THEN 'en_cours'
  WHEN 'Déployé'           THEN 'deploye'
  WHEN 'Abandonné'         THEN 'cloture'
  ELSE COALESCE(statut, 'backlog')
END
WHERE statut_portefeuille IS NOT NULL;
