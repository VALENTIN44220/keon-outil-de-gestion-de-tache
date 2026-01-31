-- Add form_schema JSONB column to process_templates
ALTER TABLE public.process_templates 
ADD COLUMN IF NOT EXISTS form_schema JSONB DEFAULT NULL;

-- Add form_schema to sub_process_templates as well for sub-process specific forms
ALTER TABLE public.sub_process_templates 
ADD COLUMN IF NOT EXISTS form_schema JSONB DEFAULT NULL;

-- Create a function to generate default form schema for existing processes
CREATE OR REPLACE FUNCTION public.generate_default_form_schema(p_process_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_schema JSONB;
  v_sections JSONB;
  v_fields JSONB;
  v_placements JSONB;
  v_common_fields JSONB;
BEGIN
  -- Create default section
  v_sections := jsonb_build_array(
    jsonb_build_object(
      'id', 'default_section',
      'name', 'informations',
      'label', 'Informations',
      'description', NULL,
      'columns', 2,
      'is_collapsible', false,
      'is_collapsed_by_default', false,
      'order_index', 0,
      'condition', NULL
    )
  );

  -- Get all fields for this process and create placements
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'field_id', tcf.id,
        'section_id', 'default_section',
        'column_index', 0,
        'column_span', 2,
        'row_index', tcf.order_index,
        'order_index', tcf.order_index,
        'overrides', jsonb_build_object(
          'label', tcf.label,
          'description', tcf.description,
          'placeholder', tcf.placeholder,
          'is_required', tcf.is_required,
          'is_readonly', false,
          'is_hidden', false,
          'default_value', tcf.default_value
        ),
        'validation', CASE 
          WHEN tcf.validation_type IS NOT NULL THEN
            jsonb_build_object(
              'type', tcf.validation_type,
              'message', tcf.validation_message,
              'params', tcf.validation_params
            )
          ELSE NULL
        END,
        'condition', CASE 
          WHEN tcf.condition_field_id IS NOT NULL THEN
            jsonb_build_object(
              'field_id', tcf.condition_field_id,
              'operator', tcf.condition_operator,
              'value', tcf.condition_value,
              'logic', COALESCE(tcf.conditions_logic, 'AND'),
              'additional', tcf.additional_conditions
            )
          ELSE NULL
        END
      )
      ORDER BY tcf.order_index
    ),
    '[]'::jsonb
  )
  INTO v_placements
  FROM template_custom_fields tcf
  WHERE tcf.process_template_id = p_process_id
    AND tcf.is_common = false;

  -- Get common fields configuration
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'field_id', tcf.id,
        'enabled', true
      )
    ),
    '[]'::jsonb
  )
  INTO v_common_fields
  FROM template_custom_fields tcf
  WHERE tcf.process_template_id = p_process_id
    AND tcf.is_common = true;

  -- Build final schema
  v_schema := jsonb_build_object(
    'version', 1,
    'sections', v_sections,
    'placements', v_placements,
    'common_fields', jsonb_build_object(
      'requester', true,
      'company', true,
      'department', true,
      'priority', false,
      'due_date', false
    ),
    'common_field_overrides', v_common_fields,
    'global_settings', jsonb_build_object(
      'columns', 2,
      'show_section_borders', true,
      'compact_mode', false
    )
  );

  RETURN v_schema;
END;
$$;

-- Populate form_schema for all existing processes that don't have one
UPDATE public.process_templates pt
SET form_schema = public.generate_default_form_schema(pt.id)
WHERE pt.form_schema IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.process_templates.form_schema IS 'JSONB schema containing form layout, field placements, validations, conditions, and UI overrides';
COMMENT ON COLUMN public.sub_process_templates.form_schema IS 'JSONB schema for sub-process specific form configuration';