-- Migration : introduction des statuts BE 'soumise' et 'affectee'
--
-- 1. Élargir la contrainte CHECK be_status pour accepter les nouvelles valeurs
-- 2. Reclasser les données existantes

BEGIN;

-- Supprimer l'ancienne contrainte CHECK
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_be_status_check;

-- Recréer avec les nouvelles valeurs
ALTER TABLE tasks ADD CONSTRAINT tasks_be_status_check CHECK (
  be_status IN (
    'soumise',
    'affectee',
    'en_cours',
    'a_relire',
    'a_valider',
    'a_deposer',
    'en_instruction',
    'complement_demande',
    'cloturee'
  )
);

-- Tâches BE sans assignée → soumise
UPDATE tasks
SET be_status = 'soumise'
WHERE be_status = 'en_cours'
  AND be_project_id IS NOT NULL
  AND assignee_id IS NULL;

-- Tâches BE assignées mais pas encore démarrées → affectee
UPDATE tasks
SET be_status = 'affectee'
WHERE be_status = 'en_cours'
  AND be_project_id IS NOT NULL
  AND assignee_id IS NOT NULL
  AND type = 'task';

COMMIT;
