-- Demande de nouveau fournisseur : lignes en attente d'approbation (miroir supplier_purchase_enrichment + line_index + pays).
-- line_index: UUID unique par soumission (généré côté client), stable pour filtrer / supprimer des lots.

CREATE TABLE IF NOT EXISTS public.supplier_waiting_approval (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_index UUID NOT NULL,
  tiers TEXT,
  nomfournisseur TEXT,
  categorie TEXT,
  famille_source_initiale TEXT,
  famille TEXT,
  segment TEXT,
  sous_segment TEXT,
  entite TEXT,
  type_de_contrat TEXT,
  validite_prix DATE,
  validite_du_contrat DATE,
  date_premiere_signature DATE,
  avenants TEXT,
  evolution_tarif_2026 TEXT,
  echeances_de_paiement TEXT,
  delai_de_paiement TEXT,
  penalites TEXT,
  exclusivite_non_sollicitation TEXT,
  remise TEXT,
  rfa TEXT,
  incoterm TEXT,
  garanties_bancaire_et_equipement TEXT,
  transport TEXT,
  nom_contact TEXT,
  poste TEXT,
  adresse_mail TEXT,
  telephone TEXT,
  commentaires TEXT,
  commentaires_date_contrat TEXT,
  commentaires_type_de_contrat TEXT,
  site_web TEXT,
  delais_de_paiement_commentaires TEXT,
  completeness_score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'a_completer' CHECK (status IN ('a_completer', 'en_cours', 'complet')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  ca_estime NUMERIC,
  description TEXT,
  siret TEXT,
  tva TEXT,
  pays TEXT
);

COMMENT ON COLUMN public.supplier_waiting_approval.line_index IS
  'Identifiant de soumission (UUID). Une même valeur peut regrouper plusieurs lignes futures ; aujourd’hui une ligne par demande.';
COMMENT ON COLUMN public.supplier_waiting_approval.pays IS
  'Pays (formulaire création) ; colonne supplémentaire par rapport à l’historique fournisseur.';

-- tiers : nullable, pas d’unicité dans cette table (contrairement au référentiel).

CREATE INDEX IF NOT EXISTS idx_supplier_waiting_line_index ON public.supplier_waiting_approval (line_index);
CREATE INDEX IF NOT EXISTS idx_supplier_waiting_created_at ON public.supplier_waiting_approval (created_at DESC);

-- Si un tiers est renseigné sur une ligne en attente : ne doit pas exister déjà dans le référentiel.
-- Plusieurs lignes en attente peuvent partager la même valeur de tiers (pas d’unicité sur supplier_waiting_approval).
CREATE OR REPLACE FUNCTION public.enforce_waiting_tiers_vs_enrichment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tiers IS NOT NULL AND btrim(NEW.tiers) <> '' THEN
    IF EXISTS (SELECT 1 FROM public.supplier_purchase_enrichment e WHERE e.tiers = NEW.tiers) THEN
      RAISE EXCEPTION 'Le tiers % existe déjà dans le référentiel fournisseurs', NEW.tiers;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_supplier_waiting_tiers_unique
  BEFORE INSERT OR UPDATE OF tiers ON public.supplier_waiting_approval
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_waiting_tiers_vs_enrichment();

CREATE OR REPLACE FUNCTION public.enforce_enrichment_tiers_vs_waiting()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tiers IS NOT NULL AND btrim(NEW.tiers) <> '' THEN
    IF EXISTS (
      SELECT 1 FROM public.supplier_waiting_approval w
      WHERE w.tiers IS NOT NULL AND btrim(w.tiers) <> '' AND w.tiers = NEW.tiers
    ) THEN
      RAISE EXCEPTION 'Le tiers % est déjà réservé par une demande fournisseur en attente', NEW.tiers;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_enrichment_tiers_vs_waiting
  BEFORE INSERT OR UPDATE OF tiers ON public.supplier_purchase_enrichment
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_enrichment_tiers_vs_waiting();

CREATE TRIGGER trg_supplier_waiting_approval_updated_at
  BEFORE UPDATE ON public.supplier_waiting_approval
  FOR EACH ROW
  EXECUTE FUNCTION public.update_supplier_enrichment_updated_at();

ALTER TABLE public.supplier_waiting_approval ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Achat and Compta can read supplier waiting approval"
  ON public.supplier_waiting_approval
  FOR SELECT
  USING (public.has_supplier_access());

CREATE POLICY "Achat and Compta can insert supplier waiting approval"
  ON public.supplier_waiting_approval
  FOR INSERT
  WITH CHECK (public.has_supplier_access());

CREATE POLICY "Achat and Compta can update supplier waiting approval"
  ON public.supplier_waiting_approval
  FOR UPDATE
  USING (public.has_supplier_access());

CREATE POLICY "Achat and Compta can delete supplier waiting approval"
  ON public.supplier_waiting_approval
  FOR DELETE
  USING (public.has_supplier_access());

-- Pièces jointes (RIB, Kbis / SIRET) liées à une ligne d’attente
CREATE TABLE IF NOT EXISTS public.supplier_waiting_approval_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waiting_approval_id UUID NOT NULL REFERENCES public.supplier_waiting_approval(id) ON DELETE CASCADE,
  attachment_kind TEXT NOT NULL CHECK (attachment_kind IN ('rib', 'justificatif_siret')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_waiting_approval_attachment_kind UNIQUE (waiting_approval_id, attachment_kind)
);

CREATE INDEX IF NOT EXISTS idx_supplier_waiting_att_waiting ON public.supplier_waiting_approval_attachments (waiting_approval_id);

ALTER TABLE public.supplier_waiting_approval_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier waiting attachments select"
  ON public.supplier_waiting_approval_attachments
  FOR SELECT
  USING (public.has_supplier_access());

CREATE POLICY "supplier waiting attachments insert"
  ON public.supplier_waiting_approval_attachments
  FOR INSERT
  WITH CHECK (public.has_supplier_access());

CREATE POLICY "supplier waiting attachments delete"
  ON public.supplier_waiting_approval_attachments
  FOR DELETE
  USING (public.has_supplier_access());

INSERT INTO storage.buckets (id, name, public)
VALUES ('supplier-waiting-attachments', 'supplier-waiting-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can upload supplier waiting attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'supplier-waiting-attachments');

CREATE POLICY "Authenticated can read supplier waiting attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'supplier-waiting-attachments');

CREATE POLICY "Authenticated can delete supplier waiting attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'supplier-waiting-attachments');
