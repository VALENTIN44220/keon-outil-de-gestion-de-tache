
-- Add granular supplier permissions to permission_profiles (mirroring BE projects pattern)
ALTER TABLE public.permission_profiles
  ADD COLUMN IF NOT EXISTS can_view_suppliers boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_create_suppliers boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_edit_suppliers boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_delete_suppliers boolean NOT NULL DEFAULT false;

-- Migrate existing can_access_suppliers → can_view_suppliers
UPDATE public.permission_profiles
SET can_view_suppliers = can_access_suppliers
WHERE can_access_suppliers = true;

-- Add granular supplier permissions to user_permission_overrides
ALTER TABLE public.user_permission_overrides
  ADD COLUMN IF NOT EXISTS can_view_suppliers boolean DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS can_create_suppliers boolean DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS can_edit_suppliers boolean DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS can_delete_suppliers boolean DEFAULT NULL;

-- Update has_supplier_access() to use can_view_suppliers instead of can_access_suppliers
CREATE OR REPLACE FUNCTION public.has_supplier_access()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Admin always has access
  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  ) THEN
    RETURN true;
  END IF;

  -- Check permission profile + user overrides for can_view_suppliers
  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    LEFT JOIN public.permission_profiles pp ON pp.id = p.permission_profile_id
    LEFT JOIN public.user_permission_overrides uo ON uo.user_id = p.user_id
    WHERE p.user_id = auth.uid()
      AND COALESCE(uo.can_view_suppliers, pp.can_view_suppliers, false) = true
  ) THEN
    RETURN true;
  END IF;

  -- Direct supplier permissions (by JWT email)
  RETURN EXISTS (
    SELECT 1
    FROM public.supplier_purchase_permissions spp
    WHERE spp.is_active = true
      AND lower(spp.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );
END;
$function$;
