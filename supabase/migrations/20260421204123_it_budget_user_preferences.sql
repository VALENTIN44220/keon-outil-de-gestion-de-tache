-- =========================================================================
-- IT Budget — Préférences utilisateur (colonnes visibles, ordre, filtres)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.it_budget_user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Config colonnes : { visible: string[], order: string[] }
  columns_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Filtres persistés : { annee, entite, type_depense, categorie, ... }
  filters_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.it_budget_user_preferences ENABLE ROW LEVEL SECURITY;

-- L'utilisateur ne voit et ne modifie que ses propres préférences
CREATE POLICY "Users can select own IT budget preferences"
  ON public.it_budget_user_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own IT budget preferences"
  ON public.it_budget_user_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own IT budget preferences"
  ON public.it_budget_user_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own IT budget preferences"
  ON public.it_budget_user_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger updated_at (réutilise la fonction existante si elle existe)
CREATE OR REPLACE FUNCTION public.set_updated_at_it_budget_prefs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_it_budget_user_preferences_updated_at
  ON public.it_budget_user_preferences;

CREATE TRIGGER tr_it_budget_user_preferences_updated_at
  BEFORE UPDATE ON public.it_budget_user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_it_budget_prefs();

COMMENT ON TABLE public.it_budget_user_preferences IS
  'Préférences utilisateur pour l''affichage du tableau IT Budget (colonnes, ordre, filtres).';