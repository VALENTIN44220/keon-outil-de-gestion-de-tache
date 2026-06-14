-- CLIENT 002 — Flux "Création client" : groupes d'approbateurs + process +
-- 3 sous-processus séquentiels (Contrôle CRM → Contrôle Compta → Création
-- affaire). Approbateurs alignés sur le flux Power Automate.

INSERT INTO collaborator_groups (id, name, description, created_by) VALUES
  ('33333333-3333-4333-8333-000000000010','Contrôle CRM','Validation CRM création client (Hugues, Valentin, Diane)','791009d8-65f2-40ac-be5f-d0c468df1480'),
  ('33333333-3333-4333-8333-000000000011','Compta — Création client','Création client + code client (Mélanie, Corinne, Shnorh)','791009d8-65f2-40ac-be5f-d0c468df1480')
ON CONFLICT (id) DO NOTHING;
INSERT INTO collaborator_group_members (group_id, user_id) VALUES
  ('33333333-3333-4333-8333-000000000010','9144d1ff-71dd-4273-8b58-54927ad87773'),
  ('33333333-3333-4333-8333-000000000010','81750c79-efb6-48e2-8788-0ec9a6f13b68'),
  ('33333333-3333-4333-8333-000000000010','02aa7530-1c27-4784-a1b3-dea15b453f40'),
  ('33333333-3333-4333-8333-000000000011','1041eae7-a58e-4c62-bd9b-3134f1e7eaf9'),
  ('33333333-3333-4333-8333-000000000011','011e0abd-c763-42e4-b4ca-d0d3e7384396'),
  ('33333333-3333-4333-8333-000000000011','28d2525e-9ccc-4b13-904d-ff0dcaab4b46')
ON CONFLICT DO NOTHING;

DO $$
DECLARE v_user uuid;
BEGIN
  SELECT user_id INTO v_user FROM process_templates WHERE user_id IS NOT NULL LIMIT 1;

  INSERT INTO process_templates (id, name, description, user_id, is_shared, visibility_level, recurrence_enabled, created_at, updated_at)
  VALUES ('44444444-4444-4444-8444-000000000001','Création client','Demande de création client (et affaire) — chaîne CRM → Compta → Affaire', v_user, true, 'public', false, now(), now())
  ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, updated_at=now();

  INSERT INTO sub_process_templates (id, process_template_id, name, assignment_type, target_group_id, target_assignee_id, order_index, is_mandatory, visibility_level, user_id)
  VALUES
    ('44444444-4444-4444-8444-000000000101','44444444-4444-4444-8444-000000000001','Contrôle CRM','team','33333333-3333-4333-8333-000000000010',NULL,0,true,'public',v_user),
    ('44444444-4444-4444-8444-000000000102','44444444-4444-4444-8444-000000000001','Contrôle Compta (création client)','team','33333333-3333-4333-8333-000000000011',NULL,1,true,'public',v_user),
    ('44444444-4444-4444-8444-000000000103','44444444-4444-4444-8444-000000000001','Création affaire','fixed_user',NULL,'fcadea9b-7e9d-48ca-9208-c29c07d90a9f',2,false,'public',v_user)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO task_templates (sub_process_template_id, process_template_id, title, priority, order_index, start_mode, validation_level_1, validation_level_2, visibility_level, user_id)
  VALUES
    ('44444444-4444-4444-8444-000000000101','44444444-4444-4444-8444-000000000001','Contrôle CRM','medium',0,'parallel','free','none','public',v_user),
    ('44444444-4444-4444-8444-000000000102','44444444-4444-4444-8444-000000000001','Contrôle Compta — créer le client + code client','medium',0,'parallel','free','none','public',v_user),
    ('44444444-4444-4444-8444-000000000103','44444444-4444-4444-8444-000000000001','Création affaire + code affaire','medium',0,'parallel','free','none','public',v_user)
  ON CONFLICT DO NOTHING;
END $$;
