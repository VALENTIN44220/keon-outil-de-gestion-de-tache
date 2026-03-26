-- =========================================================
-- Spreadsheet template propagation fix
--
-- Current situation (observed):
-- - Other projects get the spreadsheet field definition,
--   but spreadsheet_template stays NULL, so they show "Insérer un tableau".
-- - The template update from the widget is likely blocked by RLS policy
--   `qfd_update` which only allows updates if `created_by` matches or admin.
--
-- Fix:
-- - Allow UPDATE on custom field definitions (is_builtin=false) when the
--   user has the corresponding `qst_pilier_<code>_write` permission.
-- =========================================================

BEGIN;

DROP POLICY IF EXISTS "qfd_update" ON public.questionnaire_field_definitions;

CREATE POLICY "qfd_update"
ON public.questionnaire_field_definitions FOR UPDATE
TO authenticated
USING (
  is_builtin = false
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.permission_profiles pp ON pp.id = p.permission_profile_id
      WHERE p.user_id = auth.uid()
      AND (
        (pilier_code = '00' AND pp.qst_pilier_00_write = true) OR
        (pilier_code = '02' AND pp.qst_pilier_02_write = true) OR
        (pilier_code = '04' AND pp.qst_pilier_04_write = true) OR
        (pilier_code = '05' AND pp.qst_pilier_05_write = true) OR
        (pilier_code = '06' AND pp.qst_pilier_06_write = true) OR
        (pilier_code = '07' AND pp.qst_pilier_07_write = true)
      )
    )
  )
)
WITH CHECK (
  is_builtin = false
);

COMMIT;

