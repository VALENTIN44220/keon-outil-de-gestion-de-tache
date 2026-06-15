-- Permission unique "modifier les données des projets SPV" (case à cocher profil)
-- + durcissement RLS de project_field_values (suppression de la branche
-- permissive is_builtin=false qui ouvrait les champs personnalisés à tout
-- utilisateur authentifié).

-- 1. Nouvelle colonne de permission (niveau profil)
ALTER TABLE public.permission_profiles
  ADD COLUMN IF NOT EXISTS can_edit_spv_data boolean NOT NULL DEFAULT false;

-- 1b. Surcharge par utilisateur (null = hérite du profil)
ALTER TABLE public.user_permission_overrides
  ADD COLUMN IF NOT EXISTS can_edit_spv_data boolean;

-- 2. Backfill depuis l'écriture par pilier existante (uniforme par profil)
--    -> Administrateur & Manager conservent le droit d'édition.
UPDATE public.permission_profiles
  SET can_edit_spv_data = COALESCE(qst_pilier_00_write, false);

-- 3. Durcissement RLS de project_field_values
--    - écriture : admin OU can_edit_spv_data
--    - lecture  : admin OU lecture du pilier correspondant
--    - SUPPRESSION de la branche "is_builtin = false"
DROP POLICY IF EXISTS pfv_select ON public.project_field_values;
DROP POLICY IF EXISTS pfv_insert ON public.project_field_values;
DROP POLICY IF EXISTS pfv_update ON public.project_field_values;

CREATE POLICY pfv_select ON public.project_field_values
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM questionnaire_field_definitions fd
    JOIN profiles p ON p.user_id = auth.uid()
    JOIN permission_profiles pp ON pp.id = p.permission_profile_id
    WHERE fd.id = project_field_values.field_def_id
      AND (
        (fd.pilier_code = '00' AND pp.qst_pilier_00_read = true) OR
        (fd.pilier_code = '02' AND pp.qst_pilier_02_read = true) OR
        (fd.pilier_code = '04' AND pp.qst_pilier_04_read = true) OR
        (fd.pilier_code = '05' AND pp.qst_pilier_05_read = true) OR
        (fd.pilier_code = '06' AND pp.qst_pilier_06_read = true) OR
        (fd.pilier_code = '07' AND pp.qst_pilier_07_read = true)
      )
  )
);

-- Écriture = permission EFFECTIVE : surcharge utilisateur si présente, sinon profil.
-- (auth.uid() = profiles.user_id ; user_permission_overrides.user_id = profiles.id)
CREATE POLICY pfv_insert ON public.project_field_values
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM profiles p
    LEFT JOIN permission_profiles pp ON pp.id = p.permission_profile_id
    LEFT JOIN user_permission_overrides uo ON uo.user_id = p.id
    WHERE p.user_id = auth.uid()
      AND COALESCE(uo.can_edit_spv_data, pp.can_edit_spv_data, false) = true
  )
);

CREATE POLICY pfv_update ON public.project_field_values
FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM profiles p
    LEFT JOIN permission_profiles pp ON pp.id = p.permission_profile_id
    LEFT JOIN user_permission_overrides uo ON uo.user_id = p.id
    WHERE p.user_id = auth.uid()
      AND COALESCE(uo.can_edit_spv_data, pp.can_edit_spv_data, false) = true
  )
);
