-- SST 001 — Registre des "situations à risque" (COPIL SST)
-- Reproduit la liste SharePoint "REMONTEES DES SITUATIONS A RISQUES".
-- Appliquée en prod via MCP Supabase (migration sst_001_situations_register).
-- Ce fichier sert de référence dans le repo pour les déploiements ultérieurs.

CREATE TABLE IF NOT EXISTS public.sst_situations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_evenement date NOT NULL DEFAULT CURRENT_DATE,
  type_situation text NOT NULL CHECK (type_situation IN (
    'Accident avec AT','Accident sans AT','Presque accident','Situation à risque',
    'Axe d''amélioration','Action COPIL SST','Incident site'
  )),
  titre text,
  societe text,
  service text,
  projet text,
  lieu_environnement text CHECK (lieu_environnement IS NULL OR lieu_environnement IN ('Route','Site','Agence')),
  circonstances text,
  lesions text,
  victime_keon_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  victime_externe text,
  temoin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text,
  arbre_causes text CHECK (arbre_causes IS NULL OR arbre_causes IN ('A FAIRE','PLANIFIER','REALISE','NC')),
  etat_avancement text NOT NULL DEFAULT 'A TRAITER' CHECK (etat_avancement IN ('A TRAITER','EN COURS','VALIDE')),
  validation_codir text,
  declarant_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_sst_etat ON public.sst_situations(etat_avancement) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sst_type ON public.sst_situations(type_situation) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sst_declarant ON public.sst_situations(declarant_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.sst_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_sst_updated_at ON public.sst_situations;
CREATE TRIGGER trg_sst_updated_at BEFORE UPDATE ON public.sst_situations
  FOR EACH ROW EXECUTE FUNCTION public.sst_set_updated_at();

ALTER TABLE public.sst_situations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sst_insert_all ON public.sst_situations;
CREATE POLICY sst_insert_all ON public.sst_situations FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS sst_select_all ON public.sst_situations;
CREATE POLICY sst_select_all ON public.sst_situations FOR SELECT TO authenticated USING (deleted_at IS NULL);

DROP POLICY IF EXISTS sst_update_admin_or_declarant ON public.sst_situations;
CREATE POLICY sst_update_admin_or_declarant ON public.sst_situations FOR UPDATE TO authenticated USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR declarant_id = (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid() LIMIT 1)
  OR EXISTS (
    SELECT 1 FROM ((profiles p
      LEFT JOIN permission_profiles pp ON pp.id = p.permission_profile_id)
      LEFT JOIN user_permission_overrides upo ON upo.user_id = p.id)
    WHERE p.user_id = auth.uid()
      AND COALESCE(upo.can_manage_smq, pp.can_manage_smq, false) = true)
);

-- Permission d'accès écran (OFF par défaut — activée via Admin → Droits & Accès)
ALTER TABLE public.permission_profiles ADD COLUMN IF NOT EXISTS can_access_sst boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_permission_overrides ADD COLUMN IF NOT EXISTS can_access_sst boolean DEFAULT null;
