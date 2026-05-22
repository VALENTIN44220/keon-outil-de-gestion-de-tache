-- ════════════════════════════════════════════════════════════════════════
-- Budget SPV — affaires de montage de projet (code 'M')
-- Réplique la mécanique budget du BE : affaires + lignes de budget + KPI
-- CA/COGS/marges depuis Divalto (CCN/FCN/CFN/FFN) + coût RH (Lucca).
-- ════════════════════════════════════════════════════════════════════════

-- 1. Affaires SPV (les codes M n'existent pas dans be_affaires)
CREATE TABLE IF NOT EXISTS public.spv_affaires (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_affaire text NOT NULL UNIQUE,
  libelle      text,
  status       text NOT NULL DEFAULT 'en_cours',
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Seed : tous les codes M présents dans les saisies de temps Lucca
INSERT INTO public.spv_affaires (code_affaire)
SELECT DISTINCT code_site
FROM public.lucca_saisie_temps
WHERE code_site ILIKE 'M%'
ON CONFLICT (code_affaire) DO NOTHING;

-- 2. Lignes de budget SPV (mirror be_affaire_budget_lines)
CREATE TABLE IF NOT EXISTS public.spv_affaire_budget_lines (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spv_affaire_id        uuid NOT NULL REFERENCES public.spv_affaires(id) ON DELETE CASCADE,
  poste                 text NOT NULL,
  fournisseur_prevu     text,
  description           text,
  montant_budget        numeric NOT NULL,
  montant_budget_revise numeric,
  type_depense          text,
  exercice              integer,
  statut                text NOT NULL DEFAULT 'brouillon',
  commentaire           text,
  created_by            uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spv_budget_lines_affaire ON public.spv_affaire_budget_lines(spv_affaire_id);

-- 3. RLS — accès aux utilisateurs authentifiés (le gating fin se fait côté app
--    via la permission can_access_spv sur la route /spv/budget).
ALTER TABLE public.spv_affaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spv_affaire_budget_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS spv_affaires_select ON public.spv_affaires;
CREATE POLICY spv_affaires_select ON public.spv_affaires FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS spv_affaires_write ON public.spv_affaires;
CREATE POLICY spv_affaires_write ON public.spv_affaires FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS spv_blines_select ON public.spv_affaire_budget_lines;
CREATE POLICY spv_blines_select ON public.spv_affaire_budget_lines FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS spv_blines_write ON public.spv_affaire_budget_lines;
CREATE POLICY spv_blines_write ON public.spv_affaire_budget_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Vue KPI budget SPV : CA/COGS/marges (Divalto M) + coût RH (Lucca) + budget manuel
CREATE OR REPLACE VIEW public.v_spv_affaire_budget_kpi AS
WITH temps AS (
  SELECT code_affaire, jours_declares, cout_rh_declare
  FROM public.v_spv_affaire_temps_kpi
),
budget AS (
  SELECT spv_affaire_id, SUM(COALESCE(montant_budget_revise, montant_budget)) AS budget_total
  FROM public.spv_affaire_budget_lines
  GROUP BY spv_affaire_id
)
SELECT
  a.id          AS spv_affaire_id,
  a.code_affaire,
  a.libelle     AS affaire_libelle,
  a.status      AS affaire_status,
  COALESCE(SUM(CASE WHEN m.type_mouv = 'CCN' THEN m.montant_ht END), 0::numeric) AS ca_engage_brut,
  COALESCE(SUM(CASE WHEN m.type_mouv = 'FCN' THEN m.montant_ht END), 0::numeric) AS ca_constate_brut,
  COALESCE(SUM(CASE WHEN m.type_mouv = 'CFN' THEN m.montant_ht END), 0::numeric) AS cogs_engage_brut,
  COALESCE(SUM(CASE WHEN m.type_mouv = 'FFN' THEN m.montant_ht END), 0::numeric) AS cogs_constate_brut,
  COALESCE(SUM(CASE WHEN m.type_mouv = 'FCN' THEN m.montant_ht END), 0::numeric)
    - COALESCE(SUM(CASE WHEN m.type_mouv = 'FFN' THEN m.montant_ht END), 0::numeric) AS marge_brute,
  COALESCE(SUM(CASE WHEN m.type_mouv = 'FCN' THEN m.montant_ht END), 0::numeric)
    - COALESCE(SUM(CASE WHEN m.type_mouv = 'FFN' THEN m.montant_ht END), 0::numeric)
    - COALESCE(MAX(t.cout_rh_declare), 0::numeric) AS marge_directe,
  COUNT(DISTINCT CASE WHEN m.type_mouv IN ('CCN','CFN') THEN m.numero_piece END) AS nb_commandes,
  COUNT(DISTINCT CASE WHEN m.type_mouv IN ('FCN','FFN') THEN m.numero_piece END) AS nb_factures,
  COALESCE(MAX(t.jours_declares), 0::numeric)   AS jours_declares,
  COALESCE(MAX(t.cout_rh_declare), 0::numeric)  AS cout_rh_declare,
  COALESCE(MAX(b.budget_total), 0::numeric)     AS budget_total
FROM public.spv_affaires a
LEFT JOIN public.be_divalto_mouvements m ON m.code_affaire = a.code_affaire
LEFT JOIN temps t  ON t.code_affaire = a.code_affaire
LEFT JOIN budget b ON b.spv_affaire_id = a.id
GROUP BY a.id, a.code_affaire, a.libelle, a.status;
