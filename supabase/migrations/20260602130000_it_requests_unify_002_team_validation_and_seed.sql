-- =====================================================================
-- IT_REQUESTS_UNIFY 002 — Validation 'team' + seed config étapes IT
-- =====================================================================
-- 1) Étend la CHECK constraint validation_level_X_type pour accepter 'team'
--    (peer review : n'importe quel membre de l'équipe IT sauf l'assignee).
--    Le hook useITPendingValidations (Phase C) résout les membres IT depuis
--    une constante IT_TEAM_PROFILE_IDS pour la V1.
--
-- 2) Renseigne les 10 sub_process_templates IT existants avec :
--    - dispatch_manager_id = default_assignee_profile_id de la prestation
--    - validation_level_1_type = 'team' (N1 = équipe IT, peer review)
--    - validation_level_2_type = 'requester' (N2 = demandeur)
--    - default_duration_hours selon la nature de la prestation
-- =====================================================================

-- ========== 1. ÉTENDRE CHECK VALIDATION_LEVEL_X_TYPE ==========
ALTER TABLE public.sub_process_templates
  DROP CONSTRAINT IF EXISTS sub_process_templates_validation_level_1_type_check;
ALTER TABLE public.sub_process_templates
  ADD CONSTRAINT sub_process_templates_validation_level_1_type_check
  CHECK (validation_level_1_type = ANY (ARRAY[
    'manager'::text, 'fixed_user'::text, 'requester'::text, 'team'::text
  ]));

ALTER TABLE public.sub_process_templates
  DROP CONSTRAINT IF EXISTS sub_process_templates_validation_level_2_type_check;
ALTER TABLE public.sub_process_templates
  ADD CONSTRAINT sub_process_templates_validation_level_2_type_check
  CHECK (validation_level_2_type = ANY (ARRAY[
    'manager'::text, 'fixed_user'::text, 'requester'::text, 'team'::text
  ]));

-- ========== 2. SEED CONFIG SUB_PROCESS_TEMPLATES IT ==========
-- On résout dispatch_manager_id depuis process_templates.settings.default_assignee_profile_id
-- (source de vérité actuelle de la cible d'auto-affectation).
UPDATE public.sub_process_templates spt
SET
  dispatch_manager_id      = (pt.settings->>'default_assignee_profile_id')::uuid,
  validation_level_1_type  = 'team',
  validation_level_2_type  = 'requester',
  default_duration_hours   = CASE pt.id::text
    -- Tâches courtes (intervention, matériel, SharePoint)
    WHEN '11111111-1111-4111-8111-111111111301' THEN 2   -- Ouverture SharePoint
    WHEN '11111111-1111-4111-8111-111111111306' THEN 2   -- Intervention IT
    WHEN '11111111-1111-4111-8111-111111111307' THEN 2   -- Matériel bureautique
    -- Supports applicatifs (Divalto / Pipedrive / Lucca)
    WHEN '11111111-1111-4111-8111-111111111302' THEN 4   -- Support Divalto
    WHEN '11111111-1111-4111-8111-111111111303' THEN 4   -- Support Pipedrive
    WHEN '11111111-1111-4111-8111-111111111304' THEN 4   -- Support Lucca
    -- Reporting
    WHEN '11111111-1111-4111-8111-111111111305' THEN 16  -- Reporting Power BI
    WHEN '11111111-1111-4111-8111-111111111309' THEN 16  -- Reporting hors PBI
    -- Application dédiée (gros chantier)
    WHEN '11111111-1111-4111-8111-111111111310' THEN 80  -- Application dédiée
    -- Sync auto Planner : pas de notion d'effort humain
    WHEN '11111111-1111-4111-8111-111111111308' THEN 0   -- Ticket Planner
    ELSE 4
  END,
  updated_at = now()
FROM public.process_templates pt
WHERE spt.process_template_id = pt.id
  AND pt.id::text LIKE '11111111-1111-4111-8111-1111111113%';
