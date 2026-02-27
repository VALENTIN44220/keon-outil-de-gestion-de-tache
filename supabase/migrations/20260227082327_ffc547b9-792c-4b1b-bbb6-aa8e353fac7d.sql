CREATE OR REPLACE FUNCTION public.has_supplier_access()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Admin a toujours accès
  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  ) THEN
    RETURN true;
  END IF;

  -- Permissions app (profil + surcharge utilisateur)
  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    LEFT JOIN public.permission_profiles pp ON pp.id = p.permission_profile_id
    LEFT JOIN public.user_permission_overrides uo ON uo.user_id = p.user_id
    WHERE p.user_id = auth.uid()
      AND COALESCE(uo.can_access_suppliers, pp.can_access_suppliers, false) = true
  ) THEN
    RETURN true;
  END IF;

  -- Permissions directes fournisseurs (par email JWT, sans accès table auth.users)
  RETURN EXISTS (
    SELECT 1
    FROM public.supplier_purchase_permissions spp
    WHERE spp.is_active = true
      AND lower(spp.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );
END;
$function$;