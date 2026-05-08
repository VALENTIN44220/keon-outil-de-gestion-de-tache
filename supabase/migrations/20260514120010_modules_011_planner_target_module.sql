-- ============================================================
-- MODULES 011 — Sync Planner -> module IT (et autres modules)
-- ============================================================
-- Etend planner_plan_mappings pour qu une sync Planner cree des tasks
-- dans un module specifique (IT par defaut pour TICKETS-REPORTING-DIGITAL).
--
-- L unicite reste basee sur planner_task_links.planner_task_id
-- (deja en place) -> pas de doublons.
-- ============================================================

ALTER TABLE public.planner_plan_mappings
  ADD COLUMN IF NOT EXISTS target_module_code public.module_code,
  ADD COLUMN IF NOT EXISTS target_task_type TEXT DEFAULT 'task' CHECK (target_task_type IN ('task', 'request')),
  ADD COLUMN IF NOT EXISTS target_default_assignee_profile_id UUID;

COMMENT ON COLUMN public.planner_plan_mappings.target_module_code IS
  'Si set, les taches synchronisees auront ce module_code (ex: it pour TICKETS-REPORTING-DIGITAL).';
COMMENT ON COLUMN public.planner_plan_mappings.target_task_type IS
  'task (defaut) ou request. Pour le module IT on veut request pour apparaitre dans /it/dispatch.';
COMMENT ON COLUMN public.planner_plan_mappings.target_default_assignee_profile_id IS
  'Si set, override l assignee_id par defaut (ex. equipe IT).';

-- Process_template generique pour les tickets Planner non rattaches a une prestation precise
INSERT INTO public.process_templates (
  id, name, description, user_id, is_shared, visibility_level, recurrence_enabled, created_at, updated_at
)
SELECT
  '11111111-1111-4111-8111-111111111308',
  'IT - Ticket Planner (sync auto)',
  'Tickets importes depuis le plan Planner TICKETS-REPORTING-DIGITAL via la sync Microsoft Graph.',
  (SELECT user_id FROM public.process_templates WHERE user_id IS NOT NULL LIMIT 1),
  true, 'public', false, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.process_templates WHERE id = '11111111-1111-4111-8111-111111111308'
);
