-- =========================================================================
-- IT/DIGITAL — Préférences d'affichage par utilisateur + scénarios d'embauche
-- =========================================================================

-- 1) Préférences d'affichage par utilisateur (générique : clé de vue + config JSON)
CREATE TABLE IF NOT EXISTS public.it_view_preferences (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  view_key   text NOT NULL,
  config     jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, view_key)
);
ALTER TABLE public.it_view_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_prefs_select_own" ON public.it_view_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "view_prefs_insert_own" ON public.it_view_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "view_prefs_update_own" ON public.it_view_preferences
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "view_prefs_delete_own" ON public.it_view_preferences
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.it_view_preferences IS
  'Préférences d''affichage par utilisateur et par vue (feuille de route, plan de charge…). config = JSON libre.';

-- 2) Scénarios d'embauche (plan de charge) — partagés entre utilisateurs authentifiés
CREATE TABLE IF NOT EXISTS public.fdr_hire_scenarios (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom        text NOT NULL,
  hires      jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{ profil_code, nb_etp, start_ym }]
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fdr_hire_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hire_scenarios_select_auth" ON public.fdr_hire_scenarios
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "hire_scenarios_insert_auth" ON public.fdr_hire_scenarios
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "hire_scenarios_update_auth" ON public.fdr_hire_scenarios
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "hire_scenarios_delete_auth" ON public.fdr_hire_scenarios
  FOR DELETE USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE public.fdr_hire_scenarios IS
  'Scénarios d''embauche simulés pour le plan de charge IT. hires = liste de { profil_code, nb_etp, start_ym }.';
