-- Sécurité (appliquée en prod le 2026-07-22) : les coûts salariaux nominatifs
-- (it_rh_lines) étaient lisibles par TOUT utilisateur authentifié (policy SELECT
-- USING(true)), et la vue v_it_rh_cout (non security_invoker) contournait la RLS.
-- On restreint la lecture aux utilisateurs disposant de can_access_it_budget (+ admins).

CREATE OR REPLACE FUNCTION public.current_user_can_access_it_budget()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin')
    OR COALESCE(
      (SELECT o.can_access_it_budget
         FROM public.profiles pr
         JOIN public.user_permission_overrides o ON o.user_id = pr.id
        WHERE pr.user_id = auth.uid()
        LIMIT 1),
      (SELECT pp.can_access_it_budget
         FROM public.profiles pr
         JOIN public.permission_profiles pp ON pp.id = pr.permission_profile_id
        WHERE pr.user_id = auth.uid()
        LIMIT 1),
      false
    );
$$;

DROP POLICY IF EXISTS it_rh_lines_select_all ON public.it_rh_lines;
CREATE POLICY it_rh_lines_select_budget ON public.it_rh_lines
  FOR SELECT TO authenticated
  USING (public.current_user_can_access_it_budget());

-- La vue ne lit QUE it_rh_lines → security_invoker pour qu'elle respecte la RLS.
ALTER VIEW public.v_it_rh_cout SET (security_invoker = true);
