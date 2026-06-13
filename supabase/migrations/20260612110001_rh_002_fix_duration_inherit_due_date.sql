-- ============================================================================
-- RH 002 — Les sous-tâches RH héritent l'échéance du dossier (date contrat).
--
-- task_templates.default_duration_days a un DEFAULT 1 en base : le seed RH 001
-- ne le spécifiait pas, donc les sous-tâches recevaient J+1 au lieu d'hériter
-- de la due_date de la demande (cf. fn_auto_spawn_child_tasks : l'héritage ne
-- s'applique que si default_duration_days IS NULL).
-- ============================================================================

UPDATE task_templates
SET default_duration_days = NULL
WHERE process_template_id IN (
  '11111111-1111-4111-8111-111111111601',
  '11111111-1111-4111-8111-111111111602',
  '11111111-1111-4111-8111-111111111603',
  '11111111-1111-4111-8111-111111111604'
);
