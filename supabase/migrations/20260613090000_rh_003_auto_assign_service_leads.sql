-- ============================================================================
-- RH 003 — Affectation AUTOMATIQUE des sous-tâches RH à la personne référente
-- de chaque service (au lieu du dispatch manuel par Audrey).
--
-- assignment_type='fixed_user' → le trigger fn_auto_spawn_child_tasks
-- auto-affecte target_assignee_id (statut 'todo'), sans étape de dispatch.
-- La validation N1 reste Audrey KABORE (sur task_templates).
-- Référents par service alignés sur le flux Power Automate (boîtes mailIT,
-- mailRH, mailSG, mailCOM, mailDIG, mailFMS, mailCOMPTA → 1 référent retenu).
--
-- NB : V1 = 1 référent auto par service (peut réaffecter à un collègue).
-- L'affectation à une ÉQUIPE entière (groupe) est une évolution séparée
-- (trigger + RLS group_assignee_ids + listes front).
-- ============================================================================

UPDATE sub_process_templates SET assignment_type='fixed_user', target_assignee_id = v.uid::uuid
FROM (VALUES
  -- ONBOARDING (1601)
  ('22222222-2222-4222-8222-222222221601','49d0e4b8-4c32-405f-8c9c-0c5a1fac334e'), -- Digital — Comptes & accès → Ranjit PERSAD
  ('22222222-2222-4222-8222-222222221602','149b85d9-3116-4c00-b5c2-fdf5af081e47'), -- RH — Dossier salarié → Safia MEKDAD
  ('22222222-2222-4222-8222-222222221603','46c195fd-a362-41fd-ba8a-53ba78e463e9'), -- Services Généraux → Jennifer WILKS
  ('22222222-2222-4222-8222-222222221604','d4c90849-787b-4de3-8c05-79b28835fde2'), -- Comm — Identité → Claire SASSIAS
  ('22222222-2222-4222-8222-222222221605','9144d1ff-71dd-4273-8b58-54927ad87773'), -- Digital — Applications métier → Hugues MOLTO
  ('22222222-2222-4222-8222-222222221606','17e506f2-8b1e-46e5-8641-84de7025c999'), -- Réglementaire — Formation → Florence MARTIN-SISTERON
  ('22222222-2222-4222-8222-222222221607','1041eae7-a58e-4c62-bd9b-3134f1e7eaf9'), -- Comptabilité → Mélanie SAEZ
  -- OFFBOARDING (1602)
  ('22222222-2222-4222-8222-222222221611','149b85d9-3116-4c00-b5c2-fdf5af081e47'), -- RH → Safia
  ('22222222-2222-4222-8222-222222221612','49d0e4b8-4c32-405f-8c9c-0c5a1fac334e'), -- Digital comptes → Ranjit
  ('22222222-2222-4222-8222-222222221613','46c195fd-a362-41fd-ba8a-53ba78e463e9'), -- SG → Jennifer
  ('22222222-2222-4222-8222-222222221614','9144d1ff-71dd-4273-8b58-54927ad87773'), -- Digital applis → Hugues
  ('22222222-2222-4222-8222-222222221615','1041eae7-a58e-4c62-bd9b-3134f1e7eaf9'), -- Compta → Mélanie
  -- MUTATION (1603)
  ('22222222-2222-4222-8222-222222221621','149b85d9-3116-4c00-b5c2-fdf5af081e47'), -- RH → Safia
  ('22222222-2222-4222-8222-222222221622','49d0e4b8-4c32-405f-8c9c-0c5a1fac334e'), -- Digital → Ranjit
  ('22222222-2222-4222-8222-222222221623','1041eae7-a58e-4c62-bd9b-3134f1e7eaf9'), -- Compta → Mélanie
  ('22222222-2222-4222-8222-222222221624','46c195fd-a362-41fd-ba8a-53ba78e463e9'), -- SG → Jennifer
  -- PROMOTION (1604)
  ('22222222-2222-4222-8222-222222221631','149b85d9-3116-4c00-b5c2-fdf5af081e47'), -- RH → Safia
  ('22222222-2222-4222-8222-222222221632','49d0e4b8-4c32-405f-8c9c-0c5a1fac334e')  -- Digital → Ranjit
) AS v(sp_id, uid)
WHERE sub_process_templates.id = v.sp_id::uuid;
