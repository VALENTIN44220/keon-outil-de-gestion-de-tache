-- ════════════════════════════════════════════════════════════════════════
-- Table Divalto UNIFIÉE, sans filtre, au grain LIGNE analytique.
-- Mirror brut de lakehouse_gold.mouv_gold (+ C8_gold compta) : toutes les
-- pièces (NASKEO + TerGreen), client + fournisseur, commandes + factures,
-- SANS agrégation par pièce → les imputations multi-affaires sont conservées.
-- Les modules budgétaires (BE / IT / SPV) filtrent ensuite ce dont ils ont
-- besoin (par code_affaire / préfixe / sens client-fournisseur).
--
-- Alimentée par fabric/nb_divalto_mouvements_all_sync.ipynb
--   (conflict_key = line_uid, hash de contenu de ligne).
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.divalto_mouvements_all (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_uid      text NOT NULL UNIQUE,   -- hash de contenu (idempotence, grain ligne)

  doc_type      text,                   -- 'commande' | 'facture'
  numero_piece  text,                   -- FULLCDNO (commande) ou FULLFANO (facture)
  prefix        text,                   -- CCN, CFN, FCN, FFN, CF*, FF*, CC*, FC*…
  sens          integer,                -- 2 = avoir/contrepartie → montant négatif

  axe_0001      text,
  axe_0002      text,
  code_affaire  text GENERATED ALWAYS AS (NULLIF(COALESCE(axe_0001,'') || COALESCE(axe_0002,''), '')) STORED,

  montant_ht    numeric,
  devise        text DEFAULT 'EUR',

  tiers_code    text,
  nom_tiers     text,
  fullcdno_lie  text,
  date_piece    date,
  exercice      integer,
  projet        text,
  dos           text,
  libelle       text,

  source        text,                   -- 'gescom' | 'compta'
  source_system text,                   -- 'MOUV_GOLD' | 'C8_GOLD'
  synced_at     timestamptz DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_divalto_all_code_affaire ON public.divalto_mouvements_all (code_affaire);
CREATE INDEX IF NOT EXISTS idx_divalto_all_axe1         ON public.divalto_mouvements_all (axe_0001);
CREATE INDEX IF NOT EXISTS idx_divalto_all_prefix       ON public.divalto_mouvements_all (prefix);

ALTER TABLE public.divalto_mouvements_all ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS divalto_all_select ON public.divalto_mouvements_all;
CREATE POLICY divalto_all_select ON public.divalto_mouvements_all FOR SELECT TO authenticated USING (true);

INSERT INTO public.datalake_table_catalog (table_name, display_name, description, primary_key_column, sync_enabled)
VALUES (
  'divalto_mouvements_all',
  'Divalto — mouvements unifiés (sans filtre)',
  'Mirror brut de mouv_gold/C8_gold au grain ligne. Source unique pour les budgets BE/IT/SPV.',
  'id',
  true
)
ON CONFLICT (table_name) DO UPDATE SET sync_enabled = true;
