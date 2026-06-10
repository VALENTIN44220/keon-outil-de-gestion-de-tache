-- Extension it_projects : champs pour le module Feuille de route & Plan de charge
-- Tous les champs sont additifs (aucune suppression de données existantes).

-- Portefeuille / cadrage
ALTER TABLE public.it_projects
  ADD COLUMN IF NOT EXISTS statut_portefeuille    TEXT DEFAULT 'Idée',
  ADD COLUMN IF NOT EXISTS categorie_fdr          TEXT,           -- 'IA' | 'HORS IA'
  ADD COLUMN IF NOT EXISTS activite_metier        TEXT,           -- liste administrable
  ADD COLUMN IF NOT EXISTS profil_principal       TEXT,           -- code fdr_profils
  ADD COLUMN IF NOT EXISTS sur_feuille_de_route   BOOLEAN NOT NULL DEFAULT true;

-- Dates capacitaires
ALTER TABLE public.it_projects
  ADD COLUMN IF NOT EXISTS date_kickoff           DATE,
  ADD COLUMN IF NOT EXISTS date_mep_saisie        DATE,           -- nullable : MEP forcée manuellement
  ADD COLUMN IF NOT EXISTS delai_projete_mois     INTEGER,        -- durée build en mois
  ADD COLUMN IF NOT EXISTS echeance_cible         DATE;           -- pour les tâches permanentes

-- Charge suivi (run applicatif, post-MEP)
-- La charge build est ventilée dans it_project_load (une ligne par profil).
ALTER TABLE public.it_projects
  ADD COLUMN IF NOT EXISTS suivi_j_mois           NUMERIC NOT NULL DEFAULT 0;

-- Externalisation
ALTER TABLE public.it_projects
  ADD COLUMN IF NOT EXISTS externe                BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pct_reduction_si_externe NUMERIC NOT NULL DEFAULT 0  -- 0..1
    CHECK (pct_reduction_si_externe >= 0 AND pct_reduction_si_externe <= 1),
  ADD COLUMN IF NOT EXISTS budget_externe_eur     NUMERIC NOT NULL DEFAULT 0;

-- Avancement (pour le tableau de bord suivi)
ALTER TABLE public.it_projects
  ADD COLUMN IF NOT EXISTS pct_avancement         NUMERIC NOT NULL DEFAULT 0
    CHECK (pct_avancement >= 0 AND pct_avancement <= 100);
