
-- ============================================================
-- Innovation Requests Module — Step 2: Tables + RLS
-- ============================================================

-- Helper function to check inno_admin role
CREATE OR REPLACE FUNCTION public.is_inno_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('inno_admin', 'admin')
  )
$$;

-- Reference: code_projet options
CREATE TABLE public.inno_code_projet_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inno_code_projet_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_inno_codes" ON public.inno_code_projet_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage_inno_codes" ON public.inno_code_projet_options FOR ALL TO authenticated USING (public.is_inno_admin()) WITH CHECK (public.is_inno_admin());

INSERT INTO public.inno_code_projet_options (code, label) VALUES
  ('MIXI', 'MIXI'), ('MONI', 'MONI'), ('GPEI', 'GPEI'), ('CAPC', 'CAPC');

-- Reference: usage options
CREATE TABLE public.inno_usage_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inno_usage_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_inno_usage" ON public.inno_usage_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage_inno_usage" ON public.inno_usage_options FOR ALL TO authenticated USING (public.is_inno_admin()) WITH CHECK (public.is_inno_admin());

INSERT INTO public.inno_usage_options (code, label) VALUES
  ('exploitation', 'Exploitation'), ('maintenance', 'Maintenance'),
  ('developpement', 'Développement'), ('construction', 'Construction'),
  ('etudes', 'Etudes'), ('conception', 'Conception'),
  ('administratif', 'Administratif'), ('commerce_methaniseur', 'Commerce Méthaniseur'),
  ('bpa', 'BPA');

-- Reference: etiquettes suggestions
CREATE TABLE public.inno_etiquette_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inno_etiquette_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_inno_etiquettes" ON public.inno_etiquette_suggestions FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage_inno_etiquettes" ON public.inno_etiquette_suggestions FOR ALL TO authenticated USING (public.is_inno_admin()) WITH CHECK (public.is_inno_admin());

-- Main table: inno_demandes
CREATE TABLE public.inno_demandes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  statut_demande text NOT NULL DEFAULT 'Soumise'
    CHECK (statut_demande IN ('Soumise', 'En instruction', 'A passer CODIR', 'Validée', 'Refusée', 'En attente info')),
  nom_projet text NOT NULL,
  code_projet text NOT NULL,
  descriptif text NOT NULL,
  commentaire_demande text,
  demandeur_id uuid NOT NULL REFERENCES public.profiles(id),
  entite_concernee text NOT NULL
    CHECK (entite_concernee IN ('NASKEO', 'KEON.BIO', 'TEIKEI', 'SYCOMORE', 'KEON', 'CAPCOO', 'INTERFILIALE', 'GECO2', 'EXTERNE')),
  usage text NOT NULL,
  etiquettes text[] DEFAULT '{}',
  sponsor text,
  etat_projet text DEFAULT 'A arbitrer'
    CHECK (etat_projet IN ('A arbitrer', 'A débuter', 'En cours', 'A déployer', 'Terminé', 'Ecarté', 'Standby', 'Non viable')),
  service_porteur_id uuid REFERENCES public.departments(id),
  responsable_projet_id uuid REFERENCES public.profiles(id),
  challenge_inno text DEFAULT 'A arbitrer'
    CHECK (challenge_inno IN ('Oui', 'Non', 'A arbitrer')),
  date_debut date,
  date_fin_previsionnelle date,
  livrable_final text,
  difficulte_complexite integer CHECK (difficulte_complexite BETWEEN 1 AND 10),
  niveau_strategique integer CHECK (niveau_strategique BETWEEN 1 AND 10),
  priorisation_urgence text CHECK (priorisation_urgence IN ('1', '2', '3')),
  audit_log jsonb DEFAULT '[]'::jsonb
);

CREATE TRIGGER update_inno_demandes_updated_at
  BEFORE UPDATE ON public.inno_demandes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.inno_demandes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inno_insert" ON public.inno_demandes FOR INSERT TO authenticated
  WITH CHECK (demandeur_id = public.current_profile_id());

CREATE POLICY "inno_select" ON public.inno_demandes FOR SELECT TO authenticated
  USING (demandeur_id = public.current_profile_id() OR public.is_inno_admin());

CREATE POLICY "inno_update" ON public.inno_demandes FOR UPDATE TO authenticated
  USING (demandeur_id = public.current_profile_id() OR public.is_inno_admin());

CREATE POLICY "inno_delete" ON public.inno_demandes FOR DELETE TO authenticated
  USING (public.is_inno_admin());
