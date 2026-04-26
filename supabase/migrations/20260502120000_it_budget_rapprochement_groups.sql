-- =========================================================================
-- IT Budget — Groupes de rapprochement
-- =========================================================================
-- Permet de regrouper plusieurs lignes budgétaires sous un identifiant
-- métier persistant (ex: "Migration Divalto Q3 2026") avant qu'une commande
-- ou facture Divalto ne soit liée. Une commande affectée au groupe doit
-- ensuite être propagée à toutes les lignes membres.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.it_budget_rapprochement_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  description TEXT,
  exercice INT,
  entite TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_it_budget_rapproch_groups_exercice
  ON public.it_budget_rapprochement_groups (exercice);

ALTER TABLE public.it_budget_rapprochement_groups ENABLE ROW LEVEL SECURITY;

-- Lecture / écriture pour tout utilisateur authentifié, suppression
-- réservée au créateur (cohérent avec les autres tables IT Budget).
DROP POLICY IF EXISTS "Auth users can read IT budget rapproch groups"
  ON public.it_budget_rapprochement_groups;
CREATE POLICY "Auth users can read IT budget rapproch groups"
  ON public.it_budget_rapprochement_groups
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth users can insert IT budget rapproch groups"
  ON public.it_budget_rapprochement_groups;
CREATE POLICY "Auth users can insert IT budget rapproch groups"
  ON public.it_budget_rapprochement_groups
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth users can update IT budget rapproch groups"
  ON public.it_budget_rapprochement_groups;
CREATE POLICY "Auth users can update IT budget rapproch groups"
  ON public.it_budget_rapprochement_groups
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Creator can delete IT budget rapproch groups"
  ON public.it_budget_rapprochement_groups;
CREATE POLICY "Creator can delete IT budget rapproch groups"
  ON public.it_budget_rapprochement_groups
  FOR DELETE USING (auth.uid() = created_by);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at_it_budget_rapproch_groups()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS tr_it_budget_rapproch_groups_updated_at
  ON public.it_budget_rapprochement_groups;
CREATE TRIGGER tr_it_budget_rapproch_groups_updated_at
  BEFORE UPDATE ON public.it_budget_rapprochement_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_it_budget_rapproch_groups();

-- ─── Lien lignes <-> groupe ───────────────────────────────────────────
ALTER TABLE public.it_budget_lines
  ADD COLUMN IF NOT EXISTS rapprochement_group_id UUID
    REFERENCES public.it_budget_rapprochement_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_it_budget_lines_rapproch_group
  ON public.it_budget_lines (rapprochement_group_id);

COMMENT ON COLUMN public.it_budget_lines.rapprochement_group_id IS
  'Groupe de rapprochement métier auquel appartient cette ligne. Une commande/facture liée au groupe est propagée à toutes les lignes membres.';

COMMENT ON TABLE public.it_budget_rapprochement_groups IS
  'Groupes nommés permettant de rattacher plusieurs lignes budgétaires IT à une même commande/facture Divalto, avant ou après le rapprochement.';
