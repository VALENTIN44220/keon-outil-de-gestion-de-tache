
-- ==========================================================
-- VALIDATION DE LA DEMANDE (avant création des tâches)
-- Distinction claire vs validation des tâches (existante)
-- ==========================================================

-- 1) Ajouter les colonnes de validation de demande sur la table tasks
--    Ces colonnes ne s'appliquent qu'aux tasks de type 'request'
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS request_validation_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS request_validation_status text NOT NULL DEFAULT 'none'
    CHECK (request_validation_status IN ('none', 'pending_level_1', 'pending_level_2', 'validated', 'refused', 'returned')),
  ADD COLUMN IF NOT EXISTS request_validator_type_1 text DEFAULT NULL
    CHECK (request_validator_type_1 IS NULL OR request_validator_type_1 IN ('manager', 'department', 'group', 'user')),
  ADD COLUMN IF NOT EXISTS request_validator_id_1 uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS request_validated_by_1 uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS request_validation_1_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS request_validation_1_comment text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS request_validator_type_2 text DEFAULT NULL
    CHECK (request_validator_type_2 IS NULL OR request_validator_type_2 IN ('manager', 'department', 'group', 'user')),
  ADD COLUMN IF NOT EXISTS request_validator_id_2 uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS request_validated_by_2 uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS request_validation_2_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS request_validation_2_comment text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS request_validation_refusal_action text DEFAULT NULL
    CHECK (request_validation_refusal_action IS NULL OR request_validation_refusal_action IN ('cancel', 'return'));

-- 2) Index pour les requêtes de validation en attente
CREATE INDEX IF NOT EXISTS idx_tasks_request_validation_status 
  ON public.tasks (request_validation_status) 
  WHERE request_validation_status IN ('pending_level_1', 'pending_level_2');
