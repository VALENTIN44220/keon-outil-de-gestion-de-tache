-- Fix 1: Profiles visibility - allow same-company visibility for collaboration
-- This enables task assignment, team views, and workload planning while maintaining security

DROP POLICY IF EXISTS "Users can view own profile or admins see all" ON profiles;

CREATE POLICY "Users can view profiles in their company"
ON profiles FOR SELECT
USING (
  (auth.uid() = user_id) 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (company_id IS NOT NULL AND company_id IN (
    SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid()
  ))
  -- Also allow viewing profiles with NULL company_id for backwards compatibility
  OR (company_id IS NULL AND auth.uid() IS NOT NULL)
);

-- Fix 2: Set search_path on generate_default_form_schema function to prevent injection
CREATE OR REPLACE FUNCTION public.generate_default_form_schema(p_process_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_schema jsonb;
  v_fields jsonb[];
  v_field record;
BEGIN
  -- Get common fields first
  FOR v_field IN 
    SELECT 
      id,
      name,
      label,
      field_type,
      is_required,
      options,
      default_value,
      placeholder,
      help_text,
      order_index
    FROM template_custom_fields
    WHERE is_common = true
    ORDER BY order_index
  LOOP
    v_fields := array_append(v_fields, jsonb_build_object(
      'id', v_field.id,
      'name', v_field.name,
      'label', v_field.label,
      'type', v_field.field_type,
      'required', v_field.is_required,
      'options', v_field.options,
      'defaultValue', v_field.default_value,
      'placeholder', v_field.placeholder,
      'helpText', v_field.help_text,
      'order', v_field.order_index
    ));
  END LOOP;
  
  -- Get process-specific fields
  FOR v_field IN 
    SELECT 
      id,
      name,
      label,
      field_type,
      is_required,
      options,
      default_value,
      placeholder,
      help_text,
      order_index
    FROM template_custom_fields
    WHERE process_template_id = p_process_id
      AND is_common = false
    ORDER BY order_index
  LOOP
    v_fields := array_append(v_fields, jsonb_build_object(
      'id', v_field.id,
      'name', v_field.name,
      'label', v_field.label,
      'type', v_field.field_type,
      'required', v_field.is_required,
      'options', v_field.options,
      'defaultValue', v_field.default_value,
      'placeholder', v_field.placeholder,
      'helpText', v_field.help_text,
      'order', v_field.order_index
    ));
  END LOOP;
  
  -- Build schema
  v_schema := jsonb_build_object(
    'version', '1.0',
    'fields', COALESCE(to_jsonb(v_fields), '[]'::jsonb)
  );
  
  RETURN v_schema;
END;
$$;