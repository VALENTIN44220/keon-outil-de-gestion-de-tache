
-- Add config_mode and standard_options to wf_workflows
ALTER TABLE public.wf_workflows
  ADD COLUMN IF NOT EXISTS config_mode text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS standard_options jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS standard_template_id uuid REFERENCES public.wf_workflows(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customized_at timestamptz;

COMMENT ON COLUMN public.wf_workflows.config_mode IS 'standard or advanced';
COMMENT ON COLUMN public.wf_workflows.standard_options IS 'Simplified options when in standard mode';
COMMENT ON COLUMN public.wf_workflows.standard_template_id IS 'Reference to the standard template this workflow was created from';
COMMENT ON COLUMN public.wf_workflows.customized_at IS 'Timestamp when workflow was switched from standard to advanced';
