
-- Global standard workflow configuration (singleton-ish, one row per config key)
CREATE TABLE public.standard_workflow_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text NOT NULL UNIQUE DEFAULT 'default',
  name text NOT NULL DEFAULT 'Workflow Standard',
  description text,
  
  -- S1: Initial task status
  initial_status text NOT NULL DEFAULT 'to_assign',
  
  -- Assignment
  assignment_type text NOT NULL DEFAULT 'manager',
  assignment_target_id uuid,
  assignment_job_title_id uuid REFERENCES public.job_titles(id),
  assignment_group_id uuid REFERENCES public.collaborator_groups(id),
  
  -- Fallback
  fallback_enabled boolean NOT NULL DEFAULT false,
  fallback_assignment_type text,
  fallback_target_id uuid,
  fallback_group_id uuid REFERENCES public.collaborator_groups(id),
  fallback_job_title_id uuid REFERENCES public.job_titles(id),
  
  -- Watchers
  watcher_config jsonb DEFAULT '[]'::jsonb,
  
  -- S2: Creation notifications
  notify_requester_on_create boolean NOT NULL DEFAULT true,
  notify_assignee_on_create boolean NOT NULL DEFAULT true,
  notify_channels_create text[] NOT NULL DEFAULT '{in_app}',
  
  -- S3: Status change notifications  
  notify_requester_on_status_change boolean NOT NULL DEFAULT true,
  notify_channels_status text[] NOT NULL DEFAULT '{in_app}',
  
  -- S4: Closure notifications
  notify_requester_on_complete boolean NOT NULL DEFAULT true,
  notify_channels_complete text[] NOT NULL DEFAULT '{in_app,email}',
  
  -- Validation
  validation_levels integer NOT NULL DEFAULT 0,
  validation_1_type text DEFAULT 'manager',
  validation_1_target_id uuid,
  validation_2_type text DEFAULT 'requester',
  validation_2_target_id uuid,
  validation_timing text NOT NULL DEFAULT 'before_close',
  
  -- Metadata
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.standard_workflow_config ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins full access on standard_workflow_config"
  ON public.standard_workflow_config
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- All authenticated users can read
CREATE POLICY "Authenticated users can read standard_workflow_config"
  ON public.standard_workflow_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert default row
INSERT INTO public.standard_workflow_config (config_key, name, description)
VALUES ('default', 'Workflow Standard S1-S4', 'Configuration par défaut du workflow standard appliqué aux sous-processus.');

-- Updated_at trigger
CREATE TRIGGER update_standard_workflow_config_updated_at
  BEFORE UPDATE ON public.standard_workflow_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
