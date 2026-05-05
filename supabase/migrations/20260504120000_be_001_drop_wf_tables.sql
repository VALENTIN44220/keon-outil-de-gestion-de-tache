-- ============================================================
-- MIGRATION 001 : Suppression du moteur workflow inutilisé
-- ============================================================
-- Prérequis : audit confirmé — toutes les tables wf_* sont vides
-- en production (0 workflow_nodes configurés).
-- IRRÉVERSIBLE — exécuter uniquement après validation staging.
-- ============================================================

BEGIN;

-- Désactivation temporaire des contraintes FK pour l'ordre de suppression
SET session_replication_role = replica;

-- Tables runtime workflow (vides, jamais utilisées en prod)
DROP TABLE IF EXISTS wf_runtime_logs              CASCADE;
DROP TABLE IF EXISTS wf_runtime_instances         CASCADE;
DROP TABLE IF EXISTS workflow_execution_logs      CASCADE;
DROP TABLE IF EXISTS workflow_events              CASCADE;
DROP TABLE IF EXISTS workflow_datalake_sync_logs  CASCADE;
DROP TABLE IF EXISTS workflow_autonumber_sequences CASCADE;
DROP TABLE IF EXISTS workflow_notifications       CASCADE;
DROP TABLE IF EXISTS workflow_template_versions   CASCADE;

-- Tables instances workflow
DROP TABLE IF EXISTS workflow_validation_instances  CASCADE;
DROP TABLE IF EXISTS workflow_variable_instances    CASCADE;
DROP TABLE IF EXISTS workflow_variables             CASCADE;
DROP TABLE IF EXISTS workflow_branch_instances      CASCADE;
DROP TABLE IF EXISTS workflow_runs                  CASCADE;

-- Tables config workflow
DROP TABLE IF EXISTS wf_model_tasks                 CASCADE;
DROP TABLE IF EXISTS wf_step_sequence_validators    CASCADE;
DROP TABLE IF EXISTS wf_step_pool_validators        CASCADE;
DROP TABLE IF EXISTS wf_notifications               CASCADE;
DROP TABLE IF EXISTS wf_actions                     CASCADE;
DROP TABLE IF EXISTS wf_transitions                 CASCADE;
DROP TABLE IF EXISTS wf_task_configs                CASCADE;
DROP TABLE IF EXISTS wf_steps                       CASCADE;
DROP TABLE IF EXISTS wf_workflows                   CASCADE;

-- Tables templates workflow
DROP TABLE IF EXISTS workflow_edges                 CASCADE;
DROP TABLE IF EXISTS workflow_nodes                 CASCADE;
DROP TABLE IF EXISTS workflow_templates             CASCADE;

-- Tables config validation/assignment workflow
DROP TABLE IF EXISTS wf_validation_configs          CASCADE;
DROP TABLE IF EXISTS wf_assignment_rules            CASCADE;
DROP TABLE IF EXISTS standard_workflow_config       CASCADE;

-- Réactivation des contraintes FK
SET session_replication_role = DEFAULT;

-- Nettoyage colonne résiduelle sur sub_process_templates
-- (legacy_workflow_id ne référence plus rien)
ALTER TABLE sub_process_templates
  DROP COLUMN IF EXISTS legacy_workflow_id;

COMMIT;
