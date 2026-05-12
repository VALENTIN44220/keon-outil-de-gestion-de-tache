-- Sync Divalto suppliers (v2) avec récupération des noms manquants
--
-- Améliore la v1 :
--   - cherche le nom dans les 3 tables Divalto (au lieu d'une seule à la fois)
--   - prend le premier nom non-vide trouvé (consolidation multi-sources)
--   - UPDATE rétroactif des enrichments existants dont le nom est vide,
--     dès qu'un nom est trouvé dans n'importe quelle source
--
-- NOTE : la sync Divalto → Supabase elle-même (job ETL externe) ne
-- remonte nom_tiers/nomfournisseur que dans 10-15% des lignes. Tant que
-- ce job n'est pas corrigé en amont, beaucoup de fournisseurs resteront
-- sans nom même après cette fonction. La fix doit aussi être faite
-- côté ETL (Power Automate / Azure Data Factory / Fabric).

DROP FUNCTION IF EXISTS public.sync_divalto_suppliers_to_enrichment();

CREATE OR REPLACE FUNCTION public.sync_divalto_suppliers_to_enrichment()
RETURNS TABLE(
  inserted_count integer,
  name_updated_count integer,
  total_distinct_divalto integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer;
  v_updated integer;
  v_total integer;
BEGIN
  -- Agrège le meilleur nom par tiers, toutes sources confondues
  CREATE TEMP TABLE _divalto_tiers_names ON COMMIT DROP AS
  WITH all_rows AS (
    SELECT tiers_code AS tiers, nom_tiers AS nom
    FROM public.be_divalto_mouvements
    WHERE tiers_code IS NOT NULL AND tiers_code <> ''
    UNION ALL
    SELECT tiers, nomfournisseur FROM public.it_divalto_commandes
    WHERE tiers IS NOT NULL AND tiers <> ''
    UNION ALL
    SELECT tiers, nomfournisseur FROM public.it_divalto_factures
    WHERE tiers IS NOT NULL AND tiers <> ''
  )
  SELECT
    tiers,
    MAX(NULLIF(TRIM(COALESCE(nom, '')), '')) AS nom
  FROM all_rows
  GROUP BY tiers;

  SELECT COUNT(*) INTO v_total FROM _divalto_tiers_names;

  -- 1. INSERT des tiers manquants (avec le meilleur nom trouvé)
  WITH inserted AS (
    INSERT INTO public.supplier_purchase_enrichment (tiers, nomfournisseur)
    SELECT t.tiers, t.nom
    FROM _divalto_tiers_names t
    WHERE NOT EXISTS (
      SELECT 1 FROM public.supplier_purchase_enrichment e WHERE e.tiers = t.tiers
    )
    ON CONFLICT (tiers) DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*)::integer INTO v_inserted FROM inserted;

  -- 2. UPDATE rétroactif des noms manquants quand on en trouve un
  WITH updated AS (
    UPDATE public.supplier_purchase_enrichment e
    SET nomfournisseur = t.nom
    FROM _divalto_tiers_names t
    WHERE e.tiers = t.tiers
      AND (e.nomfournisseur IS NULL OR TRIM(e.nomfournisseur) = '')
      AND t.nom IS NOT NULL
      AND t.nom <> ''
    RETURNING e.id
  )
  SELECT COUNT(*)::integer INTO v_updated FROM updated;

  RETURN QUERY SELECT v_inserted, v_updated, v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_divalto_suppliers_to_enrichment() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_divalto_suppliers_to_enrichment() TO authenticated;
