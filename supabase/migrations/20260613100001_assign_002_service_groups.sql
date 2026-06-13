-- ASSIGN 002 — Groupes de service pour l'affectation "groupe" des flux.
-- Membres alignés sur les boîtes partagées du flux Power Automate RH.
-- NB : collaborator_groups.created_by et collaborator_group_members.user_id
--      référencent profiles.id (pas auth.users.id).
INSERT INTO collaborator_groups (id, name, description, created_by)
VALUES
  ('33333333-3333-4333-8333-000000000001','IT — Comptes & accès','Service IT / réseau','791009d8-65f2-40ac-be5f-d0c468df1480'),
  ('33333333-3333-4333-8333-000000000002','Digital — Applications métier','Divalto/Pipedrive/circuits','791009d8-65f2-40ac-be5f-d0c468df1480'),
  ('33333333-3333-4333-8333-000000000003','RH — Dossier salarié','Service RH opérationnel (hors validation Audrey)','791009d8-65f2-40ac-be5f-d0c468df1480'),
  ('33333333-3333-4333-8333-000000000004','Services Généraux','Matériel/badges/véhicules','791009d8-65f2-40ac-be5f-d0c468df1480'),
  ('33333333-3333-4333-8333-000000000005','Communication','Identité/Letsignit','791009d8-65f2-40ac-be5f-d0c468df1480'),
  ('33333333-3333-4333-8333-000000000006','Comptabilité','Comptes Yooz/avances','791009d8-65f2-40ac-be5f-d0c468df1480')
ON CONFLICT (id) DO NOTHING;

INSERT INTO collaborator_group_members (group_id, user_id)
VALUES
  ('33333333-3333-4333-8333-000000000001','49d0e4b8-4c32-405f-8c9c-0c5a1fac334e'), -- Ranjit
  ('33333333-3333-4333-8333-000000000001','741dc729-ab8f-4a4f-88f9-ffd78f3fc668'), -- Bruno
  ('33333333-3333-4333-8333-000000000002','9144d1ff-71dd-4273-8b58-54927ad87773'), -- Hugues
  ('33333333-3333-4333-8333-000000000002','81750c79-efb6-48e2-8788-0ec9a6f13b68'), -- Valentin
  ('33333333-3333-4333-8333-000000000003','149b85d9-3116-4c00-b5c2-fdf5af081e47'), -- Safia
  ('33333333-3333-4333-8333-000000000003','e7d7805d-3410-432e-aef8-ed96f4a1d985'), -- Maria
  ('33333333-3333-4333-8333-000000000003','4b64e971-eaf8-4178-a184-230e5ee1b975'), -- Camille
  ('33333333-3333-4333-8333-000000000003','c891a7d6-9b2e-400e-a039-ef5de4457f39'), -- Louis
  ('33333333-3333-4333-8333-000000000004','46c195fd-a362-41fd-ba8a-53ba78e463e9'), -- Jennifer
  ('33333333-3333-4333-8333-000000000004','dc1c5dde-7037-4896-ab0c-54c8a89d9616'), -- Luisa
  ('33333333-3333-4333-8333-000000000004','0987b7da-9c2e-4778-89d8-d09a13b2577d'), -- Elodie
  ('33333333-3333-4333-8333-000000000005','d4c90849-787b-4de3-8c05-79b28835fde2'), -- Claire
  ('33333333-3333-4333-8333-000000000005','d9adcfb0-379e-4fbc-80da-17f4cf0d1faa'), -- Géraldine
  ('33333333-3333-4333-8333-000000000005','02aa7530-1c27-4784-a1b3-dea15b453f40'), -- Diane
  ('33333333-3333-4333-8333-000000000006','1041eae7-a58e-4c62-bd9b-3134f1e7eaf9'), -- Mélanie
  ('33333333-3333-4333-8333-000000000006','011e0abd-c763-42e4-b4ca-d0d3e7384396')  -- Corinne
ON CONFLICT DO NOTHING;
