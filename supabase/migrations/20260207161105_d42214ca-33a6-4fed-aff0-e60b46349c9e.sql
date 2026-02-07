-- PROCESSUS "DEMANDE SERVICE ACHAT" - NOUVEAU FOURNISSEUR

-- 1) Groupes
INSERT INTO public.collaborator_groups (id, name, description) VALUES 
  ('a1111111-1111-1111-1111-111111111111', 'Service Achat', 'Groupe vérifications fournisseurs'),
  ('a2222222-2222-2222-2222-222222222222', 'Comptabilité', 'Groupe création fournisseur Divalto')
ON CONFLICT (id) DO NOTHING;

-- 2) Process Template
INSERT INTO public.process_templates (id, name, description, user_id, visibility_level, is_shared) VALUES 
  ('b1111111-1111-1111-1111-111111111111', 'DEMANDE SERVICE ACHAT', 'Processus de demande au service achat', 'cf8822d4-eb83-4605-982e-cf09a363cff1', 'public', true);

-- 3) Sub-process Template
INSERT INTO public.sub_process_templates (id, name, description, process_template_id, user_id, order_index, is_mandatory, visibility_level, assignment_type) VALUES 
  ('c1111111-1111-1111-1111-111111111111', 'DEMANDE DE NOUVEAU FOURNISSEUR', 'Sous-processus création fournisseur', 'b1111111-1111-1111-1111-111111111111', 'cf8822d4-eb83-4605-982e-cf09a363cff1', 1, true, 'public', 'role');

-- 4) Colonnes dépendance
ALTER TABLE public.task_templates ADD COLUMN IF NOT EXISTS depends_on_task_template_id UUID REFERENCES public.task_templates(id);
ALTER TABLE public.task_templates ADD COLUMN IF NOT EXISTS initial_status TEXT DEFAULT 'todo';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS depends_on_task_id UUID REFERENCES public.tasks(id);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_dependency_locked BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_tasks_depends_on_task_id ON public.tasks(depends_on_task_id);

-- 5) Task Templates
INSERT INTO public.task_templates (id, title, description, sub_process_template_id, user_id, order_index, priority, target_group_id, visibility_level, initial_status) VALUES 
  ('d1111111-1111-1111-1111-111111111111', 'Vérification fournisseur', 'Vérifier conformité et complétude', 'c1111111-1111-1111-1111-111111111111', 'cf8822d4-eb83-4605-982e-cf09a363cff1', 1, 'medium', 'a1111111-1111-1111-1111-111111111111', 'public', 'todo');

INSERT INTO public.task_templates (id, title, description, sub_process_template_id, user_id, order_index, priority, target_group_id, visibility_level, initial_status, depends_on_task_template_id) VALUES 
  ('d2222222-2222-2222-2222-222222222222', 'Création fournisseur', 'Créer fournisseur dans Divalto', 'c1111111-1111-1111-1111-111111111111', 'cf8822d4-eb83-4605-982e-cf09a363cff1', 2, 'medium', 'a2222222-2222-2222-2222-222222222222', 'public', 'pending_validation_1', 'd1111111-1111-1111-1111-111111111111');

-- 6) Sections
INSERT INTO public.form_sections (id, name, label, description, process_template_id, order_index, is_collapsible) VALUES 
  ('e1111111-1111-1111-1111-111111111111', 'infos_fournisseur', 'Informations Fournisseur', 'Infos générales', 'b1111111-1111-1111-1111-111111111111', 1, true),
  ('e2222222-2222-2222-2222-222222222222', 'contact_fournisseur', 'Contact Fournisseur', 'Coordonnées contact', 'b1111111-1111-1111-1111-111111111111', 2, true),
  ('e3333333-3333-3333-3333-333333333333', 'pieces_jointes', 'Pièces Jointes Obligatoires', 'Documents obligatoires', 'b1111111-1111-1111-1111-111111111111', 3, false);

INSERT INTO public.form_sections (id, name, label, description, sub_process_template_id, order_index, is_collapsible) VALUES 
  ('e4444444-4444-4444-4444-444444444444', 'section_comptabilite', 'Informations Comptabilité', 'Champs comptabilité', 'c1111111-1111-1111-1111-111111111111', 10, false);

-- 7) Champs personnalisés
INSERT INTO public.template_custom_fields (id, name, label, field_type, is_required, order_index, process_template_id, section_id, placeholder) VALUES 
  ('f1111111-1111-1111-1111-111111111111', 'nom_fournisseur', 'Entité sociale / Nom du fournisseur', 'text', true, 1, 'b1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 'Nom complet'),
  ('f2222222-2222-2222-2222-222222222222', 'raison_creation', 'Raison de la création', 'textarea', true, 2, 'b1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 'Justification'),
  ('f3333333-3333-3333-3333-333333333333', 'description_bien_service', 'Description du bien/service', 'textarea', true, 3, 'b1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 'Description'),
  ('f5555555-5555-5555-5555-555555555555', 'pays_fournisseur', 'Pays', 'text', true, 5, 'b1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 'France'),
  ('f7777777-7777-7777-7777-777777777777', 'montant_ca_annuel', 'Montant estimé CA annuel (€)', 'number', true, 7, 'b1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', '50000'),
  ('f8888888-8888-8888-8888-888888888888', 'numero_siret', 'N° SIRET', 'text', false, 8, 'b1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', '12345678901234'),
  ('f9999999-9999-9999-9999-999999999999', 'numero_tva', 'N° TVA Intracommunautaire', 'text', false, 9, 'b1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 'FR12345678901'),
  ('fa111111-1111-1111-1111-111111111111', 'contact_nom', 'Nom du contact', 'text', true, 1, 'b1111111-1111-1111-1111-111111111111', 'e2222222-2222-2222-2222-222222222222', 'Prénom NOM'),
  ('fa222222-2222-2222-2222-222222222222', 'contact_email', 'Email du contact', 'email', true, 2, 'b1111111-1111-1111-1111-111111111111', 'e2222222-2222-2222-2222-222222222222', 'email@example.com'),
  ('fa333333-3333-3333-3333-333333333333', 'contact_telephone', 'Téléphone du contact', 'phone', true, 3, 'b1111111-1111-1111-1111-111111111111', 'e2222222-2222-2222-2222-222222222222', '+33 1 23 45 67 89');

INSERT INTO public.template_custom_fields (id, name, label, field_type, is_required, order_index, process_template_id, section_id, options) VALUES 
  ('f4444444-4444-4444-4444-444444444444', 'famille', 'Famille', 'select', true, 4, 'b1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', '["Matériel", "Sous-traitance", "Services", "Consommables", "Logiciels", "Autre"]'::jsonb),
  ('f6666666-6666-6666-6666-666666666666', 'delai_paiement', 'Délais de paiement', 'select', true, 6, 'b1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', '["30 jours", "45 jours", "60 jours", "Comptant"]'::jsonb),
  ('fa444444-4444-4444-4444-444444444444', 'contact_role', 'Rôle du contact', 'select', true, 4, 'b1111111-1111-1111-1111-111111111111', 'e2222222-2222-2222-2222-222222222222', '["Commercial", "Directeur", "Administratif", "Technique"]'::jsonb);

-- Pièces jointes obligatoires
INSERT INTO public.template_custom_fields (id, name, label, field_type, is_required, order_index, process_template_id, section_id, description) VALUES 
  ('fb111111-1111-1111-1111-111111111111', 'pj_rib', 'RIB du fournisseur', 'file', true, 1, 'b1111111-1111-1111-1111-111111111111', 'e3333333-3333-3333-3333-333333333333', 'Document obligatoire'),
  ('fb222222-2222-2222-2222-222222222222', 'pj_siret', 'Justificatif SIRET / Kbis', 'file', true, 2, 'b1111111-1111-1111-1111-111111111111', 'e3333333-3333-3333-3333-333333333333', 'Document obligatoire');

-- Champ comptabilité
INSERT INTO public.template_custom_fields (id, name, label, field_type, is_required, order_index, sub_process_template_id, section_id, placeholder, description) VALUES 
  ('fc111111-1111-1111-1111-111111111111', 'numero_tiers_divalto', 'N° Fournisseur (TIERS Divalto)', 'text', true, 1, 'c1111111-1111-1111-1111-111111111111', 'e4444444-4444-4444-4444-444444444444', '401XXXXX', 'OBLIGATOIRE pour terminer');

-- 8) Triggers dépendances
CREATE OR REPLACE FUNCTION public.unlock_dependent_tasks() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('done', 'validated') AND OLD.status NOT IN ('done', 'validated') THEN
    UPDATE public.tasks SET is_dependency_locked = false, status = 'todo', updated_at = now()
    WHERE depends_on_task_id = NEW.id AND is_dependency_locked = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_unlock_dependent_tasks ON public.tasks;
CREATE TRIGGER trg_unlock_dependent_tasks AFTER UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.unlock_dependent_tasks();

ALTER TABLE public.task_status_transitions ADD COLUMN IF NOT EXISTS refusal_reason TEXT;