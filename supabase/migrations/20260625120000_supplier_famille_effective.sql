-- Colonne effective pour la Famille : repli sur la famille source (datalake)
-- quand la famille saisie est vide ou nulle.
-- Sert au filtre et au tri côté serveur (PostgREST) en plus de l'affichage.

ALTER TABLE public.supplier_purchase_enrichment
  ADD COLUMN IF NOT EXISTS famille_effective TEXT
  GENERATED ALWAYS AS (
    COALESCE(NULLIF(famille, ''), NULLIF(famille_source_initiale, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_supplier_enrichment_famille_effective
  ON public.supplier_purchase_enrichment (famille_effective);
