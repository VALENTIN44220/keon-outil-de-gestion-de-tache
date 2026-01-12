-- Table BE Projects (Bureau d'Études)
CREATE TABLE public.be_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code_projet TEXT NOT NULL UNIQUE,
  nom_projet TEXT NOT NULL,
  description TEXT,
  -- Adresses
  adresse_site TEXT,
  adresse_societe TEXT,
  pays TEXT DEFAULT 'FRANCE',
  pays_site TEXT,
  -- Identifiants externes
  code_divalto TEXT,
  siret TEXT,
  -- Dates clés
  date_cloture_bancaire DATE,
  date_cloture_juridique DATE,
  date_os_etude DATE,
  date_os_travaux DATE,
  -- Classification
  actionnariat TEXT, -- Solo, Minoritaire, Majoritaire, etc.
  regime_icpe TEXT,
  typologie TEXT, -- Metha agricole, Metha territoriale, etc.
  -- Équipe projet (références aux profiles)
  charge_affaires_id UUID REFERENCES public.profiles(id),
  developpeur_id UUID REFERENCES public.profiles(id),
  ingenieur_etudes_id UUID REFERENCES public.profiles(id),
  ingenieur_realisation_id UUID REFERENCES public.profiles(id),
  projeteur_id UUID REFERENCES public.profiles(id),
  -- Métadonnées
  status TEXT NOT NULL DEFAULT 'active', -- active, closed, on_hold
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.be_projects ENABLE ROW LEVEL SECURITY;

-- Policies for BE Projects
CREATE POLICY "Everyone in company can view BE projects" 
  ON public.be_projects FOR SELECT 
  USING (true);

CREATE POLICY "Users with permission can insert BE projects" 
  ON public.be_projects FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users with permission can update BE projects" 
  ON public.be_projects FOR UPDATE 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete BE projects" 
  ON public.be_projects FOR DELETE 
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_be_projects_updated_at
  BEFORE UPDATE ON public.be_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add be_project_id to tasks table for linking
ALTER TABLE public.tasks 
  ADD COLUMN be_project_id UUID REFERENCES public.be_projects(id);

-- Table for BE Task Labels/Types (étiquettes)
CREATE TABLE public.be_task_labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3b82f6',
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.be_task_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view BE task labels" 
  ON public.be_task_labels FOR SELECT 
  USING (true);

CREATE POLICY "Admins can manage BE task labels" 
  ON public.be_task_labels FOR ALL 
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add label to tasks
ALTER TABLE public.tasks 
  ADD COLUMN be_label_id UUID REFERENCES public.be_task_labels(id);

-- Add RBE validation fields to tasks (double validation)
ALTER TABLE public.tasks 
  ADD COLUMN rbe_validator_id UUID REFERENCES public.profiles(id),
  ADD COLUMN rbe_validated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN rbe_validation_status TEXT DEFAULT 'pending', -- pending, approved, rejected
  ADD COLUMN rbe_validation_comment TEXT,
  ADD COLUMN requester_validated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN requester_validation_status TEXT DEFAULT 'pending', -- pending, approved, rejected
  ADD COLUMN requester_validation_comment TEXT;

-- Add index for faster project lookups
CREATE INDEX idx_tasks_be_project_id ON public.tasks(be_project_id);
CREATE INDEX idx_be_projects_code ON public.be_projects(code_projet);

-- Sequence for project code generation
CREATE SEQUENCE IF NOT EXISTS be_project_code_seq START WITH 1001;

-- Function to generate project code
CREATE OR REPLACE FUNCTION generate_be_project_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code_projet IS NULL OR NEW.code_projet = '' THEN
    NEW.code_projet := 'NSK_PROJ-' || LPAD(nextval('be_project_code_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_generate_be_project_code
  BEFORE INSERT ON public.be_projects
  FOR EACH ROW
  EXECUTE FUNCTION generate_be_project_code();