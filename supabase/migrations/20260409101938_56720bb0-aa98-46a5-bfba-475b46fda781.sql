
-- Table des définitions de champs du questionnaire KEON
CREATE TABLE public.questionnaire_field_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  champ_id TEXT NOT NULL UNIQUE,
  pilier_code TEXT NOT NULL,
  section TEXT NOT NULL,
  sous_section TEXT,
  label TEXT NOT NULL,
  type_champ TEXT NOT NULL DEFAULT 'text',
  options TEXT[],
  note TEXT,
  has_evaluation_risque BOOLEAN NOT NULL DEFAULT false,
  required BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_builtin BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  spreadsheet_template JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des valeurs de champs par projet
CREATE TABLE public.project_field_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.be_projects(id) ON DELETE CASCADE,
  field_def_id UUID NOT NULL REFERENCES public.questionnaire_field_definitions(id) ON DELETE CASCADE,
  valeur TEXT,
  valeur_evaluation TEXT,
  valeur_jsonb JSONB,
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, field_def_id)
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_pfv_project_id ON public.project_field_values(project_id);
CREATE INDEX idx_pfv_field_def_id ON public.project_field_values(field_def_id);
CREATE INDEX idx_qfd_pilier_code ON public.questionnaire_field_definitions(pilier_code);
CREATE INDEX idx_qfd_is_active ON public.questionnaire_field_definitions(is_active);

-- Trigger updated_at
CREATE TRIGGER update_qfd_updated_at BEFORE UPDATE ON public.questionnaire_field_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pfv_updated_at BEFORE UPDATE ON public.project_field_values
  FOR EACH ROW EXECUTE FUNCTION public.update_project_questionnaire_updated_at();

-- RLS
ALTER TABLE public.questionnaire_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_field_values ENABLE ROW LEVEL SECURITY;

-- Policies pour questionnaire_field_definitions (lecture pour tous les authentifiés, écriture pour admins)
CREATE POLICY "Authenticated users can read field definitions"
  ON public.questionnaire_field_definitions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage field definitions"
  ON public.questionnaire_field_definitions FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Policies pour project_field_values (lecture pour tous les authentifiés, écriture pour authentifiés)
CREATE POLICY "Authenticated users can read project field values"
  ON public.project_field_values FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert project field values"
  ON public.project_field_values FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update project field values"
  ON public.project_field_values FOR UPDATE
  TO authenticated USING (true);
