-- ============================================================
-- MIGRATION 003 : Champs d'étape et extensions sub_process_templates
-- ============================================================
-- 1. Nouvelles colonnes BE sur sub_process_templates
-- 2. Nouvelle table sub_process_step_fields (champs + alertes par étape)
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. Extensions BE sur sub_process_templates
-- ────────────────────────────────────────────────────────────

-- Catégorie BE : détermine le dispatcher (Florence vs Marion)
ALTER TABLE sub_process_templates
  ADD COLUMN IF NOT EXISTS be_category TEXT
    CHECK (be_category IN ('be', 'be_reglementaire'));

-- Manager fixe qui dispatche les tâches au plan de charge
-- (différent du manager du demandeur — c'est Florence ou Marion)
ALTER TABLE sub_process_templates
  ADD COLUMN IF NOT EXISTS dispatch_manager_id UUID
    REFERENCES profiles(id) ON DELETE SET NULL;

-- Niveaux de validation directement sur l'étape (plus de couplage workflow)
ALTER TABLE sub_process_templates
  ADD COLUMN IF NOT EXISTS validation_level_1_type TEXT
    CHECK (validation_level_1_type IN ('manager', 'fixed_user', 'requester'));

ALTER TABLE sub_process_templates
  ADD COLUMN IF NOT EXISTS validation_level_1_user_id UUID
    REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE sub_process_templates
  ADD COLUMN IF NOT EXISTS validation_level_2_type TEXT
    CHECK (validation_level_2_type IN ('manager', 'fixed_user', 'requester'));

ALTER TABLE sub_process_templates
  ADD COLUMN IF NOT EXISTS validation_level_2_user_id UUID
    REFERENCES profiles(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- 2. Table sub_process_step_fields
-- Champs de saisie spécifiques à une étape (dates, liens, docs)
-- et alertes temporelles déclenchées par ces dates
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sub_process_step_fields (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_process_template_id UUID NOT NULL
    REFERENCES sub_process_templates(id) ON DELETE CASCADE,

  -- Définition du champ
  field_key             TEXT NOT NULL,   -- ex: 'date_depot', 'lien_dossier'
  field_label           TEXT NOT NULL,   -- ex: 'Date de dépôt'
  field_type            TEXT NOT NULL
    CHECK (field_type IN ('date', 'url', 'text', 'file')),
  is_required           BOOLEAN NOT NULL DEFAULT false,
  order_index           INTEGER NOT NULL DEFAULT 0,

  -- Alerte temporelle (optionnelle, uniquement pour field_type='date')
  alert_enabled         BOOLEAN NOT NULL DEFAULT false,
  alert_delay_days      INTEGER,         -- positif = après la date, négatif = avant
  alert_message         TEXT,            -- ex: 'Alerte 2 mois après la date de dépôt'
  alert_target          TEXT
    CHECK (alert_target IN ('assignee', 'dispatcher', 'requester', 'all')),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (sub_process_template_id, field_key)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_step_fields_sub_process_id
  ON sub_process_step_fields(sub_process_template_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_step_fields_updated_at ON sub_process_step_fields;
CREATE TRIGGER trg_step_fields_updated_at
  BEFORE UPDATE ON sub_process_step_fields
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ────────────────────────────────────────────────────────────
-- 3. Table task_step_field_values
-- Valeurs saisies par les IE/PJ pendant l'exécution d'une tâche
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS task_step_field_values (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id               UUID NOT NULL
    REFERENCES tasks(id) ON DELETE CASCADE,
  step_field_id         UUID NOT NULL
    REFERENCES sub_process_step_fields(id) ON DELETE CASCADE,
  value                 TEXT,            -- stockage unifié, cast selon field_type
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (task_id, step_field_id)
);

CREATE INDEX IF NOT EXISTS idx_field_values_task_id
  ON task_step_field_values(task_id);

DROP TRIGGER IF EXISTS trg_field_values_updated_at ON task_step_field_values;
CREATE TRIGGER trg_field_values_updated_at
  BEFORE UPDATE ON task_step_field_values
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
