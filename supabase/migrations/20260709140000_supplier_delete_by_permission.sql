-- Suppression d'une fiche fournisseur du référentiel : jusqu'ici réservée aux
-- admins app (politique RLS "Admins can delete supplier enrichment" + bouton UI
-- gardé sur isAdmin). On la pilote désormais par la permission granulaire
-- `can_delete_suppliers` (permission_profiles + user_permission_overrides),
-- tout en conservant l'accès admin.
--
-- Helper SECURITY DEFINER pour éviter toute dépendance à la RLS des tables de
-- permissions dans la politique.

CREATE OR REPLACE FUNCTION public.can_delete_suppliers(p_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT
    -- Admin app : accès complet
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p_uid AND ur.role = 'admin'
    )
    -- OU permission effective can_delete_suppliers = true
    -- (override utilisateur prioritaire, sinon profil de permission)
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      LEFT JOIN public.permission_profiles pp ON pp.id = p.permission_profile_id
      -- NB : user_permission_overrides.user_id référence profiles.id (pas l'auth uid)
      LEFT JOIN public.user_permission_overrides uo ON uo.user_id = p.id
      WHERE p.user_id = p_uid
        AND COALESCE(uo.can_delete_suppliers, pp.can_delete_suppliers, false) = true
    );
$function$;

-- Remplace la politique admin-only par une politique basée sur la permission.
DROP POLICY IF EXISTS "Admins can delete supplier enrichment" ON public.supplier_purchase_enrichment;

CREATE POLICY "Delete supplier enrichment with permission"
  ON public.supplier_purchase_enrichment
  FOR DELETE
  USING (public.can_delete_suppliers(auth.uid()));
