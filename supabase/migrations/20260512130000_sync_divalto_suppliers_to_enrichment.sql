-- Synchronisation automatique des fournisseurs Divalto vers l'enrichissement
--
-- Contexte : la table supplier_purchase_enrichment (= source du module
-- Fournisseurs côté UI) n'était alimentée que par le flux manuel de
-- promotion depuis supplier_waiting_approval. Du coup, les nouveaux
-- fournisseurs sync'd depuis Divalto (tables be_divalto_mouvements,
-- it_divalto_commandes, it_divalto_factures) ne remontaient JAMAIS dans
-- le module Fournisseurs — les utilisateurs voyaient des données vieilles
-- de plusieurs jours.
--
-- Ce script ajoute :
--   1. La fonction sync_divalto_suppliers_to_enrichment() qui insère les
--      tiers manquants (tiers, nomfournisseur) — les autres champs
--      (famille, segment, contrat…) restent à enrichir manuellement.
--   2. Un cron quotidien à 7h30 UTC, juste après les syncs Divalto
--      matinales (7h03–7h16 UTC).

CREATE OR REPLACE FUNCTION public.sync_divalto_suppliers_to_enrichment()
RETURNS TABLE(inserted_count integer, total_distinct_divalto integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer;
  v_total integer;
BEGIN
  WITH all_tiers AS (
    SELECT DISTINCT
      tiers_code AS tiers,
      MAX(nom_tiers) AS nomfournisseur
    FROM public.be_divalto_mouvements
    WHERE tiers_code IS NOT NULL AND tiers_code <> ''
    GROUP BY tiers_code
    UNION
    SELECT DISTINCT tiers, MAX(nomfournisseur)
    FROM public.it_divalto_commandes
    WHERE tiers IS NOT NULL AND tiers <> ''
    GROUP BY tiers
    UNION
    SELECT DISTINCT tiers, MAX(nomfournisseur)
    FROM public.it_divalto_factures
    WHERE tiers IS NOT NULL AND tiers <> ''
    GROUP BY tiers
  )
  SELECT COUNT(DISTINCT t.tiers) INTO v_total FROM all_tiers t;

  WITH all_tiers AS (
    SELECT DISTINCT
      tiers_code AS tiers,
      MAX(nom_tiers) AS nomfournisseur
    FROM public.be_divalto_mouvements
    WHERE tiers_code IS NOT NULL AND tiers_code <> ''
    GROUP BY tiers_code
    UNION
    SELECT DISTINCT tiers, MAX(nomfournisseur)
    FROM public.it_divalto_commandes
    WHERE tiers IS NOT NULL AND tiers <> ''
    GROUP BY tiers
    UNION
    SELECT DISTINCT tiers, MAX(nomfournisseur)
    FROM public.it_divalto_factures
    WHERE tiers IS NOT NULL AND tiers <> ''
    GROUP BY tiers
  ),
  to_insert AS (
    SELECT t.tiers, MAX(t.nomfournisseur) AS nomfournisseur
    FROM all_tiers t
    WHERE NOT EXISTS (
      SELECT 1 FROM public.supplier_purchase_enrichment e WHERE e.tiers = t.tiers
    )
    GROUP BY t.tiers
  ),
  inserted AS (
    INSERT INTO public.supplier_purchase_enrichment (tiers, nomfournisseur)
    SELECT tiers, nomfournisseur FROM to_insert
    ON CONFLICT (tiers) DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*)::integer INTO v_inserted FROM inserted;

  RETURN QUERY SELECT v_inserted, v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_divalto_suppliers_to_enrichment() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_divalto_suppliers_to_enrichment() TO authenticated;

-- ── Cron quotidien à 7h30 UTC ─────────────────────────────────────────────
DO $$
BEGIN
  -- Annule un éventuel cron précédent du même nom
  PERFORM cron.unschedule(jobid)
  FROM cron.job WHERE jobname = 'sync-divalto-suppliers-daily';

  PERFORM cron.schedule(
    'sync-divalto-suppliers-daily',
    '30 7 * * *',  -- tous les jours à 7h30 UTC
    $job$SELECT public.sync_divalto_suppliers_to_enrichment();$job$
  );
EXCEPTION WHEN OTHERS THEN
  -- Si pg_cron n'est pas dispo dans l'env (dev local), on ignore
  RAISE NOTICE 'pg_cron not available, skipping schedule';
END;
$$;
