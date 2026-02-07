-- =====================================================
-- RÉFÉRENTIEL FOURNISSEURS - SERVICE ACHATS
-- =====================================================

-- 1) TABLE DES PERMISSIONS D'ACCÈS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.supplier_purchase_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('achat', 'compta')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supplier_purchase_permissions ENABLE ROW LEVEL SECURITY;

-- RLS: Lecture pour les utilisateurs authentifiés (pour vérifier leur propre accès)
CREATE POLICY "Users can check their own permission"
  ON public.supplier_purchase_permissions
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND (
      email = (SELECT email FROM auth.users WHERE id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    )
  );

-- RLS: Admin peut tout gérer
CREATE POLICY "Admins can manage permissions"
  ON public.supplier_purchase_permissions
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 2) TABLE D'ENRICHISSEMENT FOURNISSEURS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.supplier_purchase_enrichment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tiers TEXT UNIQUE NOT NULL,
  nomfournisseur TEXT,
  
  -- Segmentation
  categorie TEXT,
  famille_source_initiale TEXT, -- READONLY from datalake
  famille TEXT,
  segment TEXT,
  sous_segment TEXT,
  entite TEXT,
  
  -- Contrat & Prix
  type_de_contrat TEXT,
  validite_prix DATE,
  validite_du_contrat DATE,
  date_premiere_signature DATE,
  avenants TEXT,
  evolution_tarif_2026 TEXT,
  
  -- Paiement
  echeances_de_paiement TEXT,
  delai_de_paiement TEXT,
  penalites TEXT,
  exclusivite_non_sollicitation TEXT,
  remise TEXT,
  rfa TEXT,
  
  -- Logistique
  incoterm TEXT,
  garanties_bancaire_et_equipement TEXT,
  transport TEXT,
  
  -- Contact
  nom_contact TEXT,
  poste TEXT,
  adresse_mail TEXT,
  telephone TEXT,
  
  -- Commentaires
  commentaires TEXT,
  
  -- Qualité / Status
  completeness_score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'a_completer' CHECK (status IN ('a_completer', 'en_cours', 'complet')),
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.supplier_purchase_enrichment ENABLE ROW LEVEL SECURITY;

-- Fonction pour vérifier l'accès fournisseur
CREATE OR REPLACE FUNCTION public.has_supplier_access()
RETURNS BOOLEAN AS $$
BEGIN
  -- Admin a toujours accès
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RETURN true;
  END IF;
  
  -- Vérifier la table de permissions
  RETURN EXISTS (
    SELECT 1 FROM public.supplier_purchase_permissions spp
    WHERE spp.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND spp.is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RLS: Lecture/écriture pour achat et compta
CREATE POLICY "Achat and Compta can read suppliers"
  ON public.supplier_purchase_enrichment
  FOR SELECT
  USING (public.has_supplier_access());

CREATE POLICY "Achat and Compta can insert suppliers"
  ON public.supplier_purchase_enrichment
  FOR INSERT
  WITH CHECK (public.has_supplier_access());

CREATE POLICY "Achat and Compta can update suppliers"
  ON public.supplier_purchase_enrichment
  FOR UPDATE
  USING (public.has_supplier_access());

-- 3) TRIGGER POUR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_supplier_enrichment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_supplier_enrichment_updated_at ON public.supplier_purchase_enrichment;
CREATE TRIGGER trg_supplier_enrichment_updated_at
  BEFORE UPDATE ON public.supplier_purchase_enrichment
  FOR EACH ROW
  EXECUTE FUNCTION public.update_supplier_enrichment_updated_at();

-- 4) FONCTION POUR CALCULER LE COMPLETENESS SCORE
-- =====================================================
CREATE OR REPLACE FUNCTION public.calculate_supplier_completeness(
  p_categorie TEXT,
  p_famille TEXT,
  p_segment TEXT,
  p_entite TEXT,
  p_delai_de_paiement TEXT,
  p_incoterm TEXT,
  p_adresse_mail TEXT,
  p_telephone TEXT,
  p_type_de_contrat TEXT,
  p_nom_contact TEXT
)
RETURNS INTEGER AS $$
DECLARE
  v_total INTEGER := 0;
  v_filled INTEGER := 0;
BEGIN
  -- Champs obligatoires (10 champs = 100%)
  v_total := 10;
  
  IF p_categorie IS NOT NULL AND p_categorie != '' THEN v_filled := v_filled + 1; END IF;
  IF p_famille IS NOT NULL AND p_famille != '' THEN v_filled := v_filled + 1; END IF;
  IF p_segment IS NOT NULL AND p_segment != '' THEN v_filled := v_filled + 1; END IF;
  IF p_entite IS NOT NULL AND p_entite != '' THEN v_filled := v_filled + 1; END IF;
  IF p_delai_de_paiement IS NOT NULL AND p_delai_de_paiement != '' THEN v_filled := v_filled + 1; END IF;
  IF p_incoterm IS NOT NULL AND p_incoterm != '' THEN v_filled := v_filled + 1; END IF;
  IF p_adresse_mail IS NOT NULL AND p_adresse_mail != '' THEN v_filled := v_filled + 1; END IF;
  IF p_telephone IS NOT NULL AND p_telephone != '' THEN v_filled := v_filled + 1; END IF;
  IF p_type_de_contrat IS NOT NULL AND p_type_de_contrat != '' THEN v_filled := v_filled + 1; END IF;
  IF p_nom_contact IS NOT NULL AND p_nom_contact != '' THEN v_filled := v_filled + 1; END IF;
  
  RETURN (v_filled * 100) / v_total;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5) TRIGGER POUR CALCULER LE SCORE ET STATUS
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_supplier_completeness()
RETURNS TRIGGER AS $$
BEGIN
  NEW.completeness_score := public.calculate_supplier_completeness(
    NEW.categorie,
    NEW.famille,
    NEW.segment,
    NEW.entite,
    NEW.delai_de_paiement,
    NEW.incoterm,
    NEW.adresse_mail,
    NEW.telephone,
    NEW.type_de_contrat,
    NEW.nom_contact
  );
  
  -- Mise à jour du status basé sur le score
  IF NEW.completeness_score = 100 THEN
    NEW.status := 'complet';
  ELSIF NEW.completeness_score > 0 THEN
    NEW.status := 'en_cours';
  ELSE
    NEW.status := 'a_completer';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_supplier_completeness ON public.supplier_purchase_enrichment;
CREATE TRIGGER trg_supplier_completeness
  BEFORE INSERT OR UPDATE ON public.supplier_purchase_enrichment
  FOR EACH ROW
  EXECUTE FUNCTION public.update_supplier_completeness();

-- 6) INDEX POUR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_supplier_enrichment_tiers ON public.supplier_purchase_enrichment(tiers);
CREATE INDEX IF NOT EXISTS idx_supplier_enrichment_status ON public.supplier_purchase_enrichment(status);
CREATE INDEX IF NOT EXISTS idx_supplier_enrichment_entite ON public.supplier_purchase_enrichment(entite);
CREATE INDEX IF NOT EXISTS idx_supplier_enrichment_categorie ON public.supplier_purchase_enrichment(categorie);
CREATE INDEX IF NOT EXISTS idx_supplier_permissions_email ON public.supplier_purchase_permissions(email);

-- 7) RÉALTIME POUR LA SYNCHRO
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.supplier_purchase_enrichment;