-- =========================================================================
-- IT ROI — verrouillage écriture de it_project_rh_hors_it
-- =========================================================================
-- La table portait des policies « tout utilisateur authentifié » (insert /
-- update / delete ouverts). On l'aligne sur sa table sœur it_rh_lines
-- (données de coût RH sensibles) : lecture conservée pour tous les
-- authentifiés, écriture réservée aux admins.
-- =========================================================================

DROP POLICY IF EXISTS "it_project_rh_hors_it_select" ON public.it_project_rh_hors_it;
DROP POLICY IF EXISTS "it_project_rh_hors_it_insert" ON public.it_project_rh_hors_it;
DROP POLICY IF EXISTS "it_project_rh_hors_it_update" ON public.it_project_rh_hors_it;
DROP POLICY IF EXISTS "it_project_rh_hors_it_delete" ON public.it_project_rh_hors_it;
DROP POLICY IF EXISTS "it_project_rh_hors_it_access" ON public.it_project_rh_hors_it;

-- Lecture : tous les authentifiés
CREATE POLICY "it_project_rh_hors_it_select"
  ON public.it_project_rh_hors_it FOR SELECT
  USING (true);

-- Écriture (insert/update/delete) : admins uniquement
CREATE POLICY "it_project_rh_hors_it_admin_write"
  ON public.it_project_rh_hors_it FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'::app_role
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'::app_role
    )
  );
