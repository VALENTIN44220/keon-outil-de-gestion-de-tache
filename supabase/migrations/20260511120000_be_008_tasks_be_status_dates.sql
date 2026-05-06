-- ============================================================
-- BE 008 — historique compact des transitions be_status
-- ============================================================
-- Ajoute une colonne JSONB sur `tasks` pour mémoriser le timestamp
-- de chaque entrée dans un statut BE.
--
-- Format : { "soumise": "2026-05-04T10:00:00Z", "affectee": "2026-05-04T11:00:00Z",
--            "en_cours": "2026-05-04T14:00:00Z", "a_relire": "2026-05-05T16:00:00Z",
--            "a_valider": "2026-05-06T09:00:00Z", "cloturee": "2026-05-08T17:00:00Z" }
--
-- Mis à jour côté frontend par useBETaskStatus à chaque transition
-- (merge JSONB pour ne pas écraser les autres entrées). Permet à la
-- timeline d'afficher l'historique sans table dédiée.
-- ============================================================

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS be_status_dates JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN tasks.be_status_dates IS
  'Historique des transitions be_status sous forme {statut: timestamp ISO}. Mis à jour par useBETaskStatus côté frontend.';

-- Backfill : pour les tâches BE déjà clôturées on n'a pas l'historique,
-- on initialise simplement avec le created_at sous le statut courant
-- (mieux que vide pour la timeline existante).
UPDATE tasks
SET be_status_dates = jsonb_build_object(be_status, to_jsonb(created_at))
WHERE be_status IS NOT NULL
  AND (be_status_dates IS NULL OR be_status_dates = '{}'::jsonb);
