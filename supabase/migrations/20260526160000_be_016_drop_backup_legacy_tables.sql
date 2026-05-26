-- ============================================================================
-- BE 016 — Nettoyage : suppression des tables de backup / legacy
-- ============================================================================
-- Tables vestiges de migrations passées (snapshots avant refonte BE / Excel /
-- planner). Vérifié : aucune référence dans le code applicatif (src/) ni dans
-- les autres fichiers SQL. Suppression sûre.
-- ============================================================================

DROP TABLE IF EXISTS public._backup_request_states_be_20260519;
DROP TABLE IF EXISTS public._backup_task_templates_be_v3_20260519;
DROP TABLE IF EXISTS public._backup_task_templates_before_excel_20260519;
DROP TABLE IF EXISTS public._be_legacy_sub_process_backup;
DROP TABLE IF EXISTS public._be_legacy_task_templates_backup;
DROP TABLE IF EXISTS public._planner_real_ids;
