-- Migration : introduction des statuts BE 'soumise' et 'affectee'
--
-- Avant : toutes les tâches BE démarraient à 'en_cours', qu'elles soient
--         affectées ou non. 'en_cours' couvrait donc deux états distincts.
--
-- Après :
--   soumise   = créée, pas encore affectée à quelqu'un
--   affectee  = assignée, en attente que la personne démarre (automatique)
--   en_cours  = assignée ET en cours de réalisation (bouton Commencer)
--
-- Cette migration reclasse les données existantes selon la logique :
--   • en_cours + assignee_id IS NULL     → soumise
--   • en_cours + assignee_id IS NOT NULL → affectee
--   (on suppose qu'une tâche déjà assignée n'a pas encore forcément été "démarrée")

BEGIN;

-- Tâches BE sans assignée → soumise
UPDATE tasks
SET be_status = 'soumise'
WHERE be_status = 'en_cours'
  AND be_project_id IS NOT NULL
  AND assignee_id IS NULL;

-- Tâches BE avec assignée mais statut encore à en_cours → affectee
-- (les type='request' parents sont exclus : ils gardent 'en_cours' comme statut global)
UPDATE tasks
SET be_status = 'affectee'
WHERE be_status = 'en_cours'
  AND be_project_id IS NOT NULL
  AND assignee_id IS NOT NULL
  AND type = 'task';

COMMIT;
