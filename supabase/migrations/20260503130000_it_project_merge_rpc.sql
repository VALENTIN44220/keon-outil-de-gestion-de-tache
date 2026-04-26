-- =========================================================================
-- IT — Fusion de projets (hard merge)
-- =========================================================================
-- RPC qui réassigne tous les enfants d'un ou plusieurs projets "sources"
-- vers un projet "master" puis supprime les sources.
--
-- Tables impactées (réassignation de it_project_id) :
--   - it_project_milestones
--   - it_project_phase_progress (si présent)
--   - it_project_fdr_validation (si présent)
--   - it_budget_lines
--   - it_manual_expenses
--   - it_budget_reallocations
--   - it_project_sync_logs (si présent)
--   - it_solution_projects (jonction cartographie)
--   - tasks (champ it_project_id sur les tâches)
--
-- Toute l'opération est atomique (transaction PL/pgSQL).
-- =========================================================================

CREATE OR REPLACE FUNCTION public.merge_it_projects(
  master_id UUID,
  source_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  src UUID;
BEGIN
  IF master_id IS NULL OR source_ids IS NULL OR array_length(source_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'master_id et source_ids sont requis';
  END IF;

  -- Vérifie que les projets existent
  IF NOT EXISTS (SELECT 1 FROM public.it_projects WHERE id = master_id) THEN
    RAISE EXCEPTION 'Projet master introuvable : %', master_id;
  END IF;

  FOREACH src IN ARRAY source_ids LOOP
    IF src = master_id THEN
      RAISE EXCEPTION 'Le projet master ne peut pas figurer dans la liste des sources';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.it_projects WHERE id = src) THEN
      RAISE EXCEPTION 'Projet source introuvable : %', src;
    END IF;

    -- Réassignation des enfants vers le master
    UPDATE public.it_project_milestones SET it_project_id = master_id WHERE it_project_id = src;

    -- Tables optionnelles (présentes selon historique des migrations)
    IF to_regclass('public.it_project_phase_progress') IS NOT NULL THEN
      EXECUTE format('UPDATE public.it_project_phase_progress SET it_project_id = %L WHERE it_project_id = %L', master_id, src);
    END IF;
    IF to_regclass('public.it_project_fdr_validation') IS NOT NULL THEN
      EXECUTE format('UPDATE public.it_project_fdr_validation SET it_project_id = %L WHERE it_project_id = %L', master_id, src);
    END IF;
    IF to_regclass('public.it_project_sync_logs') IS NOT NULL THEN
      EXECUTE format('UPDATE public.it_project_sync_logs SET it_project_id = %L WHERE it_project_id = %L', master_id, src);
    END IF;

    UPDATE public.it_budget_lines        SET it_project_id = master_id WHERE it_project_id = src;
    UPDATE public.it_manual_expenses     SET it_project_id = master_id WHERE it_project_id = src;
    UPDATE public.it_budget_reallocations SET it_project_id = master_id WHERE it_project_id = src;

    -- Tâches : champ it_project_id sur la table tasks
    IF to_regclass('public.tasks') IS NOT NULL THEN
      EXECUTE format('UPDATE public.tasks SET it_project_id = %L WHERE it_project_id = %L', master_id, src);
    END IF;

    -- Cartographie : mettre à jour la jonction (en évitant les doublons sur la PK composite)
    IF to_regclass('public.it_solution_projects') IS NOT NULL THEN
      EXECUTE format($f$
        INSERT INTO public.it_solution_projects (solution_id, project_id, type_lien, commentaire, created_at, created_by)
        SELECT solution_id, %L, type_lien, commentaire, created_at, created_by
        FROM public.it_solution_projects
        WHERE project_id = %L
        ON CONFLICT (solution_id, project_id) DO NOTHING
      $f$, master_id, src);

      EXECUTE format('DELETE FROM public.it_solution_projects WHERE project_id = %L', src);
    END IF;

    -- Suppression du projet source (les FK ON DELETE CASCADE éventuelles
    -- nettoient ce qu'on n'aurait pas migré)
    DELETE FROM public.it_projects WHERE id = src;
  END LOOP;

  RETURN master_id;
END;
$$;

COMMENT ON FUNCTION public.merge_it_projects(UUID, UUID[]) IS
  'Fusion atomique de projets IT : réassigne tous les enfants des projets sources vers le master puis supprime les sources. Hard merge irréversible.';

-- Permission d'exécution pour les utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION public.merge_it_projects(UUID, UUID[]) TO authenticated;
