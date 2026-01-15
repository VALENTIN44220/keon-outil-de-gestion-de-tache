-- Enum for field types
CREATE TYPE public.custom_field_type AS ENUM (
  'text',
  'textarea',
  'number',
  'date',
  'datetime',
  'email',
  'phone',
  'url',
  'checkbox',
  'select',
  'multiselect',
  'user_search',
  'department_search',
  'file'
);

-- Table for custom field definitions
CREATE TABLE public.template_custom_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  label VARCHAR(255) NOT NULL,
  field_type public.custom_field_type NOT NULL DEFAULT 'text',
  description TEXT,
  
  -- Scope: if both null = common to all; if process_template_id set = linked to process; if sub_process_template_id set = linked to sub-process
  process_template_id UUID REFERENCES public.process_templates(id) ON DELETE CASCADE,
  sub_process_template_id UUID REFERENCES public.sub_process_templates(id) ON DELETE CASCADE,
  is_common BOOLEAN NOT NULL DEFAULT false,
  
  -- Field configuration
  is_required BOOLEAN NOT NULL DEFAULT false,
  options JSONB, -- For select/multiselect: [{"value": "opt1", "label": "Option 1"}, ...]
  default_value TEXT,
  placeholder TEXT,
  validation_regex TEXT,
  min_value NUMERIC,
  max_value NUMERIC,
  
  -- Conditional display
  condition_field_id UUID REFERENCES public.template_custom_fields(id) ON DELETE SET NULL,
  condition_operator VARCHAR(20), -- 'equals', 'not_equals', 'contains', 'not_empty'
  condition_value TEXT,
  
  -- Metadata for export
  order_index INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for storing field values per task/request
CREATE TABLE public.request_field_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES public.template_custom_fields(id) ON DELETE CASCADE,
  value TEXT,
  file_url TEXT, -- For file type fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(task_id, field_id)
);

-- Enable RLS
ALTER TABLE public.template_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_field_values ENABLE ROW LEVEL SECURITY;

-- RLS Policies for template_custom_fields
CREATE POLICY "Users can view common fields and fields for visible templates"
ON public.template_custom_fields
FOR SELECT
USING (
  is_common = true
  OR (
    process_template_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.process_templates pt
      WHERE pt.id = process_template_id
      AND public.can_view_template(pt.visibility_level, pt.user_id, pt.creator_company_id, pt.creator_department_id, 'process', pt.id)
    )
  )
  OR (
    sub_process_template_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.sub_process_templates spt
      WHERE spt.id = sub_process_template_id
      AND public.can_view_template(spt.visibility_level, spt.user_id, spt.creator_company_id, spt.creator_department_id, 'sub_process', spt.id)
    )
  )
  OR created_by = public.current_profile_id()
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins and template managers can insert fields"
ON public.template_custom_fields
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    process_template_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.process_templates pt
      WHERE pt.id = process_template_id
      AND public.can_manage_template(pt.user_id)
    )
  )
  OR (
    sub_process_template_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.sub_process_templates spt
      WHERE spt.id = sub_process_template_id
      AND public.can_manage_template(spt.user_id)
    )
  )
  OR (is_common = true AND process_template_id IS NULL AND sub_process_template_id IS NULL)
);

CREATE POLICY "Admins and creators can update fields"
ON public.template_custom_fields
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin')
  OR created_by = public.current_profile_id()
);

CREATE POLICY "Admins and creators can delete fields"
ON public.template_custom_fields
FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin')
  OR created_by = public.current_profile_id()
);

-- RLS Policies for request_field_values
CREATE POLICY "Users can view field values for accessible tasks"
ON public.request_field_values
FOR SELECT
USING (
  public.can_access_task(task_id)
);

CREATE POLICY "Users can insert field values for accessible tasks"
ON public.request_field_values
FOR INSERT
WITH CHECK (
  public.can_access_task(task_id)
);

CREATE POLICY "Users can update field values for accessible tasks"
ON public.request_field_values
FOR UPDATE
USING (
  public.can_access_task(task_id)
);

CREATE POLICY "Users can delete field values for accessible tasks"
ON public.request_field_values
FOR DELETE
USING (
  public.can_access_task(task_id)
);

-- Trigger for updated_at
CREATE TRIGGER update_template_custom_fields_updated_at
BEFORE UPDATE ON public.template_custom_fields
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_request_field_values_updated_at
BEFORE UPDATE ON public.request_field_values
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_template_custom_fields_process ON public.template_custom_fields(process_template_id) WHERE process_template_id IS NOT NULL;
CREATE INDEX idx_template_custom_fields_subprocess ON public.template_custom_fields(sub_process_template_id) WHERE sub_process_template_id IS NOT NULL;
CREATE INDEX idx_template_custom_fields_common ON public.template_custom_fields(is_common) WHERE is_common = true;
CREATE INDEX idx_request_field_values_task ON public.request_field_values(task_id);
CREATE INDEX idx_request_field_values_field ON public.request_field_values(field_id);