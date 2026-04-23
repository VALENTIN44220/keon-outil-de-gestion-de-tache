-- =========================================================================
-- IT Budget — Budget type (mensuel/annuel) + options dynamiques
-- =========================================================================
-- Objectif :
--   1) Clarifier la notion "Mois budget = Annuel" : désormais un budget est
--      soit mensuel (même montant affecté à chaque mois), soit annuel (avec
--      mois de décaissement prévu). On introduit une colonne `budget_type`.
--      La colonne `mois_budget` devient le mois de décaissement quand
--      budget_type = 'annuel'.
--   2) Permettre l'ajout de valeurs personnalisées pour catégorie,
--      sous-catégorie et nature de dépense via une table `it_budget_options`.
-- =========================================================================

-- 1) Ajout de la colonne budget_type sur it_budget_lines
ALTER TABLE public.it_budget_lines
  ADD COLUMN IF NOT EXISTS budget_type TEXT
    CHECK (budget_type IN ('mensuel', 'annuel'));

-- Backfill : si mois_budget IS NULL → mensuel (le même montant chaque mois),
--            sinon → annuel (mois_budget = mois de décaissement)
UPDATE public.it_budget_lines
  SET budget_type = CASE
    WHEN mois_budget IS NULL THEN 'mensuel'
    ELSE 'annuel'
  END
  WHERE budget_type IS NULL;

ALTER TABLE public.it_budget_lines
  ALTER COLUMN budget_type SET DEFAULT 'mensuel',
  ALTER COLUMN budget_type SET NOT NULL;

COMMENT ON COLUMN public.it_budget_lines.budget_type IS
  'mensuel = même montant appliqué à chaque mois ; annuel = montant décaissé sur le mois indiqué par mois_budget';
COMMENT ON COLUMN public.it_budget_lines.mois_budget IS
  'Mois de décaissement (1-12) quand budget_type = annuel. Ignoré pour budget_type = mensuel.';

-- 2) Table pour les options personnalisées (catégorie, sous-catégorie, nature)
CREATE TABLE IF NOT EXISTS public.it_budget_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_type TEXT NOT NULL
    CHECK (option_type IN ('categorie', 'sous_categorie', 'nature_depense')),
  value TEXT NOT NULL,
  -- Contexte optionnel : sous-catégorie liée à une catégorie parente
  parent_value TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unicité : pas de doublon (option_type, parent_value, value)
CREATE UNIQUE INDEX IF NOT EXISTS uq_it_budget_options
  ON public.it_budget_options (option_type, COALESCE(parent_value, ''), value);

CREATE INDEX IF NOT EXISTS idx_it_budget_options_type
  ON public.it_budget_options (option_type);

ALTER TABLE public.it_budget_options ENABLE ROW LEVEL SECURITY;

-- Tous les utilisateurs authentifiés voient et peuvent ajouter des options.
-- Seul le créateur peut supprimer sa propre option personnalisée.
CREATE POLICY "Authenticated users can read IT budget options"
  ON public.it_budget_options
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert IT budget options"
  ON public.it_budget_options
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own IT budget options"
  ON public.it_budget_options
  FOR DELETE
  USING (auth.uid() = created_by);

COMMENT ON TABLE public.it_budget_options IS
  'Valeurs personnalisées (dropdowns addables) pour catégorie, sous-catégorie et nature de dépense du suivi budgétaire IT.';

-- 3) Unicité sur les liens ligne budgétaire <-> commande/facture
--    Permet d'utiliser un upsert (ignoreDuplicates) pour rattacher plusieurs
--    lignes à une même commande/facture sans doublon.
CREATE UNIQUE INDEX IF NOT EXISTS uq_it_budget_line_commandes_line_cdno
  ON public.it_budget_line_commandes (budget_line_id, fullcdno);

CREATE UNIQUE INDEX IF NOT EXISTS uq_it_budget_line_factures_line_ref
  ON public.it_budget_line_factures (budget_line_id, fullcdno_fac);
