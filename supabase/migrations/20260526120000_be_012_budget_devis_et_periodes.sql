-- ============================================================================
-- Migration 012 : Devis potentiel (sans commande) + table périodes pièces
-- ============================================================================

-- 1. Table pour affecter une pièce/devis à une période prévisionnelle
CREATE TABLE IF NOT EXISTS public.be_piece_periode (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_affaire    TEXT NOT NULL,
  numero_piece    TEXT NOT NULL,
  doc_type        TEXT NOT NULL,     -- 'devis', 'commande', 'facture'
  date_prevue     DATE,              -- date prévisionnelle (début de période)
  date_prevue_fin DATE,              -- fin de période (optionnel)
  note            TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (code_affaire, numero_piece)
);

ALTER TABLE public.be_piece_periode ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'be_piece_periode' AND policyname = 'be_piece_periode_all'
  ) THEN
    CREATE POLICY "be_piece_periode_all" ON public.be_piece_periode FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Drop + recreate to allow column changes
DROP VIEW IF EXISTS public.v_be_affaire_budget_kpi CASCADE;

-- 2. Mise à jour de v_be_affaire_budget_kpi :
--    - devis_client_brut = UNIQUEMENT les devis sans commande liée (CA potentiel réel)
--    - devis_client_converti_brut = devis déjà passés en commande (info uniquement)
CREATE VIEW public.v_be_affaire_budget_kpi AS
WITH div AS (
  SELECT
    d.code_affaire,
    -SUM(d.montant_ht) FILTER (WHERE d.tiers_code ILIKE 'C%' AND d.doc_type = 'commande')                                                    AS ca_engage_brut,
    -SUM(d.montant_ht) FILTER (WHERE d.tiers_code ILIKE 'C%' AND d.doc_type = 'facture')                                                     AS ca_constate_brut,
     SUM(d.montant_ht) FILTER (WHERE d.tiers_code ILIKE 'F%' AND d.doc_type = 'commande')                                                    AS cogs_engage_brut,
     SUM(d.montant_ht) FILTER (WHERE d.tiers_code ILIKE 'F%' AND d.doc_type = 'facture')                                                     AS cogs_constate_brut,
    -- Devis client sans commande liée = CA Potentiel
    -SUM(d.montant_ht) FILTER (WHERE d.tiers_code ILIKE 'C%' AND d.doc_type = 'devis' AND (d.fullcdno_lie IS NULL OR d.fullcdno_lie = ''))   AS devis_client_brut,
    -- Devis client déjà convertis en commande (info)
    -SUM(d.montant_ht) FILTER (WHERE d.tiers_code ILIKE 'C%' AND d.doc_type = 'devis' AND d.fullcdno_lie IS NOT NULL AND d.fullcdno_lie <> '') AS devis_client_converti_brut,
     SUM(d.montant_ht) FILTER (WHERE d.tiers_code ILIKE 'F%' AND d.doc_type = 'devis')                                                       AS devis_fournisseur_brut,
    COUNT(DISTINCT CASE WHEN d.doc_type = 'commande' THEN d.numero_piece END) AS nb_commandes,
    COUNT(DISTINCT CASE WHEN d.doc_type = 'facture'  THEN d.numero_piece END) AS nb_factures,
    COUNT(DISTINCT CASE WHEN d.doc_type = 'devis' AND (d.fullcdno_lie IS NULL OR d.fullcdno_lie = '') THEN d.numero_piece END) AS nb_devis
  FROM public.divalto_mouvements_all d
  WHERE d.code_affaire IS NOT NULL
  GROUP BY d.code_affaire
),
temps_par_affaire AS (
  SELECT be_affaire_id, jours_declares, heures_declarees, cout_rh_declare
  FROM public.v_be_affaire_temps_kpi
)
SELECT
  a.id           AS be_affaire_id,
  a.be_project_id,
  a.code_affaire,
  a.libelle      AS affaire_libelle,
  a.status       AS affaire_status,
  COALESCE(d.ca_engage_brut,              0) AS ca_engage_brut,
  COALESCE(d.ca_constate_brut,            0) AS ca_constate_brut,
  COALESCE(d.cogs_engage_brut,            0) AS cogs_engage_brut,
  COALESCE(d.cogs_constate_brut,          0) AS cogs_constate_brut,
  -- Marges
  (COALESCE(d.ca_constate_brut, 0) - COALESCE(d.cogs_constate_brut, 0))                                    AS marge_constatee_brut,
  (COALESCE(d.ca_constate_brut, 0) - COALESCE(d.cogs_constate_brut, 0))                                    AS marge_brute_brut,
  (COALESCE(d.ca_constate_brut, 0) - COALESCE(d.cogs_constate_brut, 0) - COALESCE(t.cout_rh_declare, 0))  AS marge_directe_brut,
  -- Compat rétro
  (COALESCE(d.ca_engage_brut, 0) + COALESCE(d.cogs_engage_brut, 0))     AS engage_montant_brut,
  (COALESCE(d.ca_constate_brut, 0) + COALESCE(d.cogs_constate_brut, 0)) AS constate_montant_brut,
  COALESCE(d.nb_commandes, 0) AS nb_commandes,
  COALESCE(d.nb_factures,  0) AS nb_factures,
  -- Temps
  COALESCE(t.jours_declares,    0) AS jours_declares,
  COALESCE(t.heures_declarees,  0) AS heures_declarees,
  COALESCE(t.cout_rh_declare,  0) AS cout_rh_declare,
  0::numeric                       AS ndf_brut,
  -- Devis
  COALESCE(d.devis_client_brut,           0) AS devis_client_brut,
  COALESCE(d.devis_client_converti_brut,  0) AS devis_client_converti_brut,
  COALESCE(d.devis_fournisseur_brut,      0) AS devis_fournisseur_brut,
  COALESCE(d.nb_devis, 0)                    AS nb_devis
FROM public.be_affaires a
LEFT JOIN div               d ON d.code_affaire  = a.code_affaire
LEFT JOIN temps_par_affaire t ON t.be_affaire_id = a.id;

COMMENT ON VIEW public.v_be_affaire_budget_kpi IS
  'KPI budgétaires affaire BE : CA/COGS/devis-potentiel/marges/MSCD depuis divalto_mouvements_all + temps Lucca. devis_client_brut = devis sans commande liée (CA Potentiel). 2026-05-26.';
