-- ============================================================
-- MODULES 001 — Architecture commune des flux metier
-- ============================================================
-- Ajoute un identifiant de module sur tasks pour pouvoir filtrer par
-- domaine metier (BE, IT, RH, Maintenance, Logistique, Comm, Innovation,
-- SMQ) sans avoir a creer une table par module.
--
-- Choix d architecture A1 : on etend `tasks` (qui porte deja RLS,
-- BE-010 notif commentaires, simulation, reassignment, comments,
-- task_status_transitions, workload_slots) plutot que de creer N tables
-- dediees.
--
-- - module_code : enum filtre sur tous les dashboards
-- - module_data : JSONB pour les champs specifiques au module
--   (ex. URGENCE / FILIALE pour Logistique, FILIALE / PRIORITE pour Comm,
--    SPONSORS / SERVICE_PORTEUR pour Innovation...)
--
-- Les champs deja existants restent partages : title, description,
-- status, assignee_id, requester_id, due_date, target_department_id,
-- source_process_template_id, source_sub_process_template_id, etc.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'module_code') THEN
    CREATE TYPE public.module_code AS ENUM (
      'be',
      'it',
      'rh',
      'maintenance',
      'logistique',
      'comm',
      'innovation',
      'smq'
    );
  END IF;
END $$;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS module_code public.module_code,
  ADD COLUMN IF NOT EXISTS module_data JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.tasks.module_code IS
  'Identifiant du module metier (be/it/rh/maintenance/logistique/comm/innovation/smq). NULL = tache classique non rattachee a un module.';
COMMENT ON COLUMN public.tasks.module_data IS
  'Donnees specifiques au module sous forme JSONB (champs conditionnels par prestation).';

CREATE INDEX IF NOT EXISTS idx_tasks_module_code
  ON public.tasks (module_code) WHERE module_code IS NOT NULL;

-- Backfill : marquer les taches BE existantes
UPDATE public.tasks
SET module_code = 'be'
WHERE module_code IS NULL
  AND (be_status IS NOT NULL OR sub_process_template_id IS NOT NULL);
