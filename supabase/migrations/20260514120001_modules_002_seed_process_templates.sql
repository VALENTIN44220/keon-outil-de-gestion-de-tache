-- ============================================================
-- MODULES 002 — Seed des process_templates par module
-- ============================================================
-- Cree les process_templates de chaque module sur la base des CDC
-- (docs/CDC/CDC_MODULES.xlsx). Les templates sont utilises ensuite par
-- les formulaires de demande pour generer les taches/sous-taches.
--
-- Pour BE : pas de seed ici, les process_templates BE existent deja.
--
-- Convention : on prefixe les UUIDs par le code module pour les
-- retrouver facilement (`select * from process_templates where name like 'IT - %'`).
-- ============================================================

-- ============== MAINTENANCE ==============
-- 1 prestation : DEMANDE DE MATERIEL (avec validation Sylvain ANTZ)
INSERT INTO public.process_templates (id, name, description, is_active, created_at, updated_at)
VALUES
  ('11111111-1111-4111-8111-111111111101', 'Maintenance - Demande de materiel', 'Demande d articles de maintenance soumise a validation du coordinateur', true, now(), now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = now();

-- ============== LOGISTIQUE ==============
-- 2 prestations : Transport + Transport URGENT (meme template, flag URGENCE)
INSERT INTO public.process_templates (id, name, description, is_active, created_at, updated_at)
VALUES
  ('11111111-1111-4111-8111-111111111201', 'Logistique - Demande de transport', 'Transport courant ou urgent (flag URGENCE)', true, now(), now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = now();

-- ============== IT / DIGITAL ==============
-- 7 prestations
INSERT INTO public.process_templates (id, name, description, is_active, created_at, updated_at)
VALUES
  ('11111111-1111-4111-8111-111111111301', 'IT - Ouverture dossier SharePoint', 'Demande de creation d un dossier SharePoint', true, now(), now()),
  ('11111111-1111-4111-8111-111111111302', 'IT - Support Divalto', 'Support fonctionnel Divalto', true, now(), now()),
  ('11111111-1111-4111-8111-111111111303', 'IT - Support Pipedrive', 'Support fonctionnel Pipedrive', true, now(), now()),
  ('11111111-1111-4111-8111-111111111304', 'IT - Support Lucca', 'Support fonctionnel Lucca', true, now(), now()),
  ('11111111-1111-4111-8111-111111111305', 'IT - Reporting Power BI', 'Demande de tableau de bord Power BI', true, now(), now()),
  ('11111111-1111-4111-8111-111111111306', 'IT - Demande d intervention IT', 'Intervention IT generique', true, now(), now()),
  ('11111111-1111-4111-8111-111111111307', 'IT - Support materiel bureautique', 'Support PC / peripherique / poste', true, now(), now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = now();

-- ============== COMMUNICATION / MARKETING ==============
-- 2 prestations
INSERT INTO public.process_templates (id, name, description, is_active, created_at, updated_at)
VALUES
  ('11111111-1111-4111-8111-111111111401', 'Comm - Demande communication marketing', 'Demande generique creation com', true, now(), now()),
  ('11111111-1111-4111-8111-111111111402', 'Comm - Reservation stand nomade', 'Reservation et logistique d un stand pour salon', true, now(), now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = now();

-- ============== INNOVATION ==============
-- 2 prestations : Nouvelle demande + MAJ avancement
INSERT INTO public.process_templates (id, name, description, is_active, created_at, updated_at)
VALUES
  ('11111111-1111-4111-8111-111111111501', 'Innovation - Nouvelle demande', 'Idee/projet innovation a instruire (avec arbitrage CODIR)', true, now(), now()),
  ('11111111-1111-4111-8111-111111111502', 'Innovation - MAJ avancement projet', 'Mise a jour de l avancement d un projet existant', true, now(), now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = now();

-- ============== RH / ONBOARDING ==============
-- 4 prestations
INSERT INTO public.process_templates (id, name, description, is_active, created_at, updated_at)
VALUES
  ('11111111-1111-4111-8111-111111111601', 'RH - Onboarding', 'Arrivee nouveau collaborateur (~33 sous-taches)', true, now(), now()),
  ('11111111-1111-4111-8111-111111111602', 'RH - Offboarding', 'Depart collaborateur (~18 sous-taches)', true, now(), now()),
  ('11111111-1111-4111-8111-111111111603', 'RH - Mutation', 'Changement societe/poste/manager (~10 sous-taches)', true, now(), now()),
  ('11111111-1111-4111-8111-111111111604', 'RH - Promotion', 'Evolution de poste (~3 sous-taches)', true, now(), now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = now();

COMMENT ON COLUMN public.process_templates.id IS
  'UUID prefixe par module : 11111111-1111-4111-8111-111111111XYZ ou XYZ = numerotation par module (101+ Maintenance, 201+ Log, 301+ IT, 401+ Comm, 501+ Inno, 601+ RH).';
