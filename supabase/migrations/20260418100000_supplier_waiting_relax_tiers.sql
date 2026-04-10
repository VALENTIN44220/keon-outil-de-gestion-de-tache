-- Déjà déployé : retirer l’unicité / la contrainte trop forte sur tiers pour supplier_waiting_approval,
-- et aligner la fonction trigger (tiers non uniques entre lignes en attente ; blocage seulement vs référentiel).

DROP INDEX IF EXISTS public.supplier_waiting_approval_tiers_key;

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
