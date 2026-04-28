-- ============================================================================
-- BE Budget Divalto - Ajustements pour les prefixes Naskeo + sync Fabric
-- ============================================================================
-- - Adapte la CHECK constraint type_mouv aux prefixes reels Divalto/Naskeo :
--     CCN, CFN (commandes client / fournisseur)
--     FCN, FFN (factures client / fournisseur)
-- - Recree les vues KPI avec un split CA (CCN/FCN) vs COGS (CFN/FFN)
--   + colonnes de compat retro (engage_montant_brut, constate_montant_brut)
--   pour ne pas casser l'UI deja en place.
-- - Whiteliste be_divalto_mouvements dans datalake_table_catalog pour
--   autoriser l'edge function bulk-upsert a y ecrire depuis Fabric.
-- ============================================================================

-- 1. CHECK constraint sur les prefixes Naskeo
ALTER TABLE public.be_divalto_mouvements
  DROP CONSTRAINT IF EXISTS be_divalto_mouvements_type_mouv_check;

ALTER TABLE public.be_divalto_mouvements
  ADD CONSTRAINT be_divalto_mouvements_type_mouv_check
    CHECK (type_mouv IN ('CCN','CFN','FCN','FFN'));

-- 2. Vues KPI : split CA / COGS, conserve les colonnes existantes
DROP VIEW IF EXISTS public.v_be_project_budget_kpi;
DROP VIEW IF EXISTS public.v_be_affaire_budget_kpi;

CREATE VIEW public.v_be_affaire_budget_kpi AS
SELECT
  a.id              AS be_affaire_id,
  a.be_project_id,
  a.code_affaire,
  a.libelle         AS affaire_libelle,
  a.status          AS affaire_status,
  -- CA (chiffre d'affaires client)
  COALESCE(SUM(CASE WHEN m.type_mouv = 'CCN' THEN m.montant_ht END), 0) AS ca_engage_brut,
  COALESCE(SUM(CASE WHEN m.type_mouv = 'FCN' THEN m.montant_ht END), 0) AS ca_constate_brut,
  -- COGS (cout des ventes / sous-traitance fournisseur)
  COALESCE(SUM(CASE WHEN m.type_mouv = 'CFN' THEN m.montant_ht END), 0) AS cogs_engage_brut,
  COALESCE(SUM(CASE WHEN m.type_mouv = 'FFN' THEN m.montant_ht END), 0) AS cogs_constate_brut,
  -- Marge constatee = CA constate - COGS constate
  COALESCE(SUM(CASE WHEN m.type_mouv = 'FCN' THEN m.montant_ht END), 0)
    - COALESCE(SUM(CASE WHEN m.type_mouv = 'FFN' THEN m.montant_ht END), 0)
    AS marge_constatee_brut,
  -- Compat retro : sommes consolidees commandes / factures
  COALESCE(SUM(CASE WHEN m.type_mouv IN ('CCN','CFN') THEN m.montant_ht END), 0) AS engage_montant_brut,
  COALESCE(SUM(CASE WHEN m.type_mouv IN ('FCN','FFN') THEN m.montant_ht END), 0) AS constate_montant_brut,
  COUNT(DISTINCT CASE WHEN m.type_mouv IN ('CCN','CFN') THEN m.numero_piece END) AS nb_commandes,
  COUNT(DISTINCT CASE WHEN m.type_mouv IN ('FCN','FFN') THEN m.numero_piece END) AS nb_factures
FROM public.be_affaires a
LEFT JOIN public.be_divalto_mouvements m
  ON m.code_affaire = a.code_affaire
GROUP BY a.id, a.be_project_id, a.code_affaire, a.libelle, a.status;

COMMENT ON VIEW public.v_be_affaire_budget_kpi IS
  'KPI engage/constate par AFFAIRE BE, split CA (CCN/FCN) vs COGS (CFN/FFN). Montants bruts : HT pour gescom, TTC pour compta - calcul HT consolide cote application.';

CREATE VIEW public.v_be_project_budget_kpi AS
SELECT
  p.id              AS be_project_id,
  p.code_projet,
  COUNT(DISTINCT a.id)                       AS nb_affaires,
  COALESCE(SUM(k.ca_engage_brut),       0)   AS ca_engage_brut,
  COALESCE(SUM(k.ca_constate_brut),     0)   AS ca_constate_brut,
  COALESCE(SUM(k.cogs_engage_brut),     0)   AS cogs_engage_brut,
  COALESCE(SUM(k.cogs_constate_brut),   0)   AS cogs_constate_brut,
  COALESCE(SUM(k.marge_constatee_brut), 0)   AS marge_constatee_brut,
  COALESCE(SUM(k.engage_montant_brut),  0)   AS engage_montant_brut,
  COALESCE(SUM(k.constate_montant_brut), 0)  AS constate_montant_brut,
  COALESCE(SUM(k.nb_commandes),         0)   AS nb_commandes,
  COALESCE(SUM(k.nb_factures),          0)   AS nb_factures
FROM public.be_projects p
LEFT JOIN public.be_affaires a            ON a.be_project_id = p.id
LEFT JOIN public.v_be_affaire_budget_kpi k ON k.be_affaire_id = a.id
GROUP BY p.id, p.code_projet;

COMMENT ON VIEW public.v_be_project_budget_kpi IS
  'KPI consolides au niveau projet BE (somme des affaires).';

-- 3. Whitelist pour l'edge function bulk-upsert
INSERT INTO public.datalake_table_catalog (table_name, display_name, description, sync_enabled)
VALUES (
  'be_divalto_mouvements',
  'BE - Mouvements Divalto',
  'Mirror Divalto pour le suivi budget BE par affaire (CCN/CFN/FCN/FFN). Aliment via notebook Fabric depuis mouv_gold + C8_gold, conflict_key composite (numero_piece,source).',
  true
)
ON CONFLICT (table_name) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      description  = EXCLUDED.description,
      sync_enabled = EXCLUDED.sync_enabled,
      updated_at   = now();
