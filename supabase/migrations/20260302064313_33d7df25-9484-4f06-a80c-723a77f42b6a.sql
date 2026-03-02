
-- Table principale des réponses au questionnaire
CREATE TABLE public.project_questionnaire (
  id                  UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id          UUID NOT NULL REFERENCES public.be_projects(id) ON DELETE CASCADE,
  code_divalto        TEXT NOT NULL,
  pilier_code         TEXT NOT NULL,
  section             TEXT NOT NULL,
  sous_section        TEXT,
  champ_id            TEXT NOT NULL,
  question            TEXT NOT NULL,
  valeur              TEXT,
  valeur_evaluation   TEXT,
  type_champ          TEXT,
  valeurs_possibles   TEXT,
  note                TEXT,
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by          UUID REFERENCES public.profiles(id),
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(project_id, champ_id)
);

CREATE INDEX idx_project_questionnaire_divalto ON public.project_questionnaire(code_divalto);
CREATE INDEX idx_project_questionnaire_pilier ON public.project_questionnaire(project_id, pilier_code);

-- Colonnes droits par pilier dans permission_profiles
ALTER TABLE public.permission_profiles
  ADD COLUMN IF NOT EXISTS qst_pilier_00_read  BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS qst_pilier_00_write BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS qst_pilier_02_read  BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS qst_pilier_02_write BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS qst_pilier_04_read  BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS qst_pilier_04_write BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS qst_pilier_05_read  BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS qst_pilier_05_write BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS qst_pilier_06_read  BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS qst_pilier_06_write BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS qst_pilier_07_read  BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS qst_pilier_07_write BOOLEAN DEFAULT false;

-- Administrateur : écriture sur tous les piliers
UPDATE public.permission_profiles
SET qst_pilier_00_write = true, qst_pilier_02_write = true, qst_pilier_04_write = true,
    qst_pilier_05_write = true, qst_pilier_06_write = true, qst_pilier_07_write = true
WHERE name = 'Administrateur';

-- RLS
ALTER TABLE public.project_questionnaire ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read questionnaire by pilier permission"
ON public.project_questionnaire FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.permission_profiles pp ON p.permission_profile_id = pp.id
    WHERE p.user_id = auth.uid()
    AND (
      (project_questionnaire.pilier_code = '00' AND pp.qst_pilier_00_read = true) OR
      (project_questionnaire.pilier_code = '02' AND pp.qst_pilier_02_read = true) OR
      (project_questionnaire.pilier_code = '04' AND pp.qst_pilier_04_read = true) OR
      (project_questionnaire.pilier_code = '05' AND pp.qst_pilier_05_read = true) OR
      (project_questionnaire.pilier_code = '06' AND pp.qst_pilier_06_read = true) OR
      (project_questionnaire.pilier_code = '07' AND pp.qst_pilier_07_read = true)
    )
  )
);

CREATE POLICY "Insert questionnaire by pilier permission"
ON public.project_questionnaire FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.permission_profiles pp ON p.permission_profile_id = pp.id
    WHERE p.user_id = auth.uid()
    AND (
      (project_questionnaire.pilier_code = '00' AND pp.qst_pilier_00_write = true) OR
      (project_questionnaire.pilier_code = '02' AND pp.qst_pilier_02_write = true) OR
      (project_questionnaire.pilier_code = '04' AND pp.qst_pilier_04_write = true) OR
      (project_questionnaire.pilier_code = '05' AND pp.qst_pilier_05_write = true) OR
      (project_questionnaire.pilier_code = '06' AND pp.qst_pilier_06_write = true) OR
      (project_questionnaire.pilier_code = '07' AND pp.qst_pilier_07_write = true)
    )
  )
);

CREATE POLICY "Update questionnaire by pilier permission"
ON public.project_questionnaire FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.permission_profiles pp ON p.permission_profile_id = pp.id
    WHERE p.user_id = auth.uid()
    AND (
      (project_questionnaire.pilier_code = '00' AND pp.qst_pilier_00_write = true) OR
      (project_questionnaire.pilier_code = '02' AND pp.qst_pilier_02_write = true) OR
      (project_questionnaire.pilier_code = '04' AND pp.qst_pilier_04_write = true) OR
      (project_questionnaire.pilier_code = '05' AND pp.qst_pilier_05_write = true) OR
      (project_questionnaire.pilier_code = '06' AND pp.qst_pilier_06_write = true) OR
      (project_questionnaire.pilier_code = '07' AND pp.qst_pilier_07_write = true)
    )
  )
);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_project_questionnaire_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_project_questionnaire_updated_at
BEFORE UPDATE ON public.project_questionnaire
FOR EACH ROW EXECUTE FUNCTION update_project_questionnaire_updated_at();
