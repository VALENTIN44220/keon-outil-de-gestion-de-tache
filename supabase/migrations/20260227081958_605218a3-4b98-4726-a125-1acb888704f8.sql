
CREATE OR REPLACE FUNCTION public.has_supplier_access()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Admin a toujours accès
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RETURN true;
  END IF;
  
  -- Vérifier via permission profile (can_access_suppliers)
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.permission_profiles pp ON p.permission_profile_id = pp.id
    WHERE p.user_id = auth.uid()
    AND pp.can_access_suppliers = true
  ) THEN
    RETURN true;
  END IF;
  
  -- Vérifier la table de permissions fournisseurs
  RETURN EXISTS (
    SELECT 1 FROM public.supplier_purchase_permissions spp
    WHERE spp.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND spp.is_active = true
  );
END;
$function$;
