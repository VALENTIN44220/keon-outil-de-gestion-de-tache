-- ============================================================
-- BE 006 — default_duration_hours sur sub_process_templates
-- ============================================================
-- Ajoute la durée prévue par défaut au niveau de la sous-étape (en
-- heures, cohérent avec tasks.duration_hours et workload_slots.
-- duration_hours).
--
-- Hérité par tasks.duration_hours à la création d'une tâche depuis
-- un template (cf. NewBERequestDialog).
-- ============================================================

ALTER TABLE sub_process_templates
  ADD COLUMN IF NOT EXISTS default_duration_hours NUMERIC;

COMMENT ON COLUMN sub_process_templates.default_duration_hours IS
  'Durée prévue par défaut pour cette sous-étape (heures). Sert à pré-remplir tasks.duration_hours à la création d''une tâche depuis ce template, et alimente le drag du backlog dans /workload.';
