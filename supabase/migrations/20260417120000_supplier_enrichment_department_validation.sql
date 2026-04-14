-- Validation métier par service (Achats / Comptabilité), avec possibilité d'annuler par le même groupe.
ALTER TABLE public.supplier_purchase_enrichment
  ADD COLUMN IF NOT EXISTS validated_by_achats_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validated_by_achats_user_id UUID REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS validated_by_compta_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validated_by_compta_user_id UUID REFERENCES public.profiles (id);

CREATE INDEX IF NOT EXISTS idx_supplier_enrichment_validated_achats_at
  ON public.supplier_purchase_enrichment (validated_by_achats_at)
  WHERE validated_by_achats_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_enrichment_validated_compta_at
  ON public.supplier_purchase_enrichment (validated_by_compta_at)
  WHERE validated_by_compta_at IS NOT NULL;
