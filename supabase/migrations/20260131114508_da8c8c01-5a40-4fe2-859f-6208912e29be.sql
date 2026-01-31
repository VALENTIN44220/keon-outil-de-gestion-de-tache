-- =====================================================
-- FORM BUILDER: Schéma pour sections et layout
-- =====================================================

-- Table des sections de formulaire
CREATE TABLE public.form_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  label VARCHAR(255) NOT NULL,
  description TEXT,
  process_template_id UUID REFERENCES public.process_templates(id) ON DELETE CASCADE,
  sub_process_template_id UUID REFERENCES public.sub_process_templates(id) ON DELETE CASCADE,
  is_common BOOLEAN NOT NULL DEFAULT false,
  is_collapsible BOOLEAN NOT NULL DEFAULT false,
  is_collapsed_by_default BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  -- Condition d'affichage de la section
  condition_field_id UUID REFERENCES public.template_custom_fields(id) ON DELETE SET NULL,
  condition_operator VARCHAR(50),
  condition_value TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.form_sections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for form_sections
CREATE POLICY "Anyone can view form sections"
  ON public.form_sections FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage form sections"
  ON public.form_sections FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Ajouter les colonnes de layout aux champs personnalisés
ALTER TABLE public.template_custom_fields
  ADD COLUMN section_id UUID REFERENCES public.form_sections(id) ON DELETE SET NULL,
  ADD COLUMN column_span INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN row_index INTEGER,
  ADD COLUMN column_index INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN width_ratio NUMERIC(3,2) DEFAULT 1.0;

-- Ajouter les règles de validation enrichies
ALTER TABLE public.template_custom_fields
  ADD COLUMN validation_type VARCHAR(50),
  ADD COLUMN validation_message TEXT,
  ADD COLUMN validation_params JSONB;

-- Types de validation prédéfinis disponibles:
-- 'phone_fr' : Téléphone français (+33/0X)
-- 'phone_intl' : Téléphone international
-- 'siret' : Numéro SIRET (14 chiffres avec algo Luhn)
-- 'siren' : Numéro SIREN (9 chiffres avec algo Luhn)
-- 'email' : Email standard
-- 'url' : URL valide
-- 'iban' : IBAN valide
-- 'postal_code_fr' : Code postal français
-- 'regex' : Expression régulière personnalisée

-- Ajouter des conditions avancées (multi-conditions)
ALTER TABLE public.template_custom_fields
  ADD COLUMN conditions_logic VARCHAR(10) DEFAULT 'AND',
  ADD COLUMN additional_conditions JSONB;

-- Index pour les performances
CREATE INDEX idx_form_sections_process ON public.form_sections(process_template_id);
CREATE INDEX idx_form_sections_subprocess ON public.form_sections(sub_process_template_id);
CREATE INDEX idx_custom_fields_section ON public.template_custom_fields(section_id);

-- Trigger pour updated_at
CREATE TRIGGER update_form_sections_updated_at
  BEFORE UPDATE ON public.form_sections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Commentaires pour documentation
COMMENT ON TABLE public.form_sections IS 'Sections de formulaire pour organiser les champs personnalisés';
COMMENT ON COLUMN public.template_custom_fields.section_id IS 'Section parente du champ (null = hors section)';
COMMENT ON COLUMN public.template_custom_fields.column_span IS 'Nombre de colonnes occupées (1-4)';
COMMENT ON COLUMN public.template_custom_fields.validation_type IS 'Type de validation prédéfini (phone_fr, siret, etc.)';
COMMENT ON COLUMN public.template_custom_fields.validation_params IS 'Paramètres additionnels pour la validation';
COMMENT ON COLUMN public.template_custom_fields.conditions_logic IS 'Logique de combinaison des conditions (AND/OR)';
COMMENT ON COLUMN public.template_custom_fields.additional_conditions IS 'Conditions supplémentaires [{field_id, operator, value}]';