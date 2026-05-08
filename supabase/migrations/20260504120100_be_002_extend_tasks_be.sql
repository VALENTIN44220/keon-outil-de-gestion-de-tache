-- ============================================================
-- MIGRATION 002 : Extensions BE sur la table tasks
-- ============================================================
-- Ajout des colonnes spécifiques au flux Bureau d'Études.
-- Toutes les colonnes sont nullable → aucun impact sur les
-- données existantes ni sur les autres flux.
-- ============================================================

BEGIN;

-- Statut métier BE (cycle de vie spécifique)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS be_status TEXT
    CHECK (be_status IN (
      'en_cours',
      'a_relire',
      'a_valider',
      'a_deposer',
      'en_instruction',
      'complement_demande',
      'cloturee'
    ));

-- Lien vers l'affaire BE
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS be_affaire_id UUID
    REFERENCES be_affaires(id) ON DELETE SET NULL;

-- Lien vers le projet BE (be_projects)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS be_project_id UUID
    REFERENCES be_projects(id) ON DELETE SET NULL;

-- Urgence de la demande BE
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS be_urgency TEXT
    CHECK (be_urgency IN ('normal', 'urgent', 'critique'));

-- Lien vers la demande de complément parente
-- (quand une demande de complément est générée depuis une demande EN_INSTRUCTION)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS parent_complement_id UUID
    REFERENCES tasks(id) ON DELETE SET NULL;

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_tasks_be_affaire_id
  ON tasks(be_affaire_id) WHERE be_affaire_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_be_project_id
  ON tasks(be_project_id) WHERE be_project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_be_status
  ON tasks(be_status) WHERE be_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_parent_complement_id
  ON tasks(parent_complement_id) WHERE parent_complement_id IS NOT NULL;

COMMIT;
