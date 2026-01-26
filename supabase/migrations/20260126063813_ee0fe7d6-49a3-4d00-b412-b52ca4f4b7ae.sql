-- =============================================
-- WORKFLOW BUILDER SYSTEM - Complete Schema
-- =============================================

-- Enum for node types
CREATE TYPE public.workflow_node_type AS ENUM (
  'start',
  'end',
  'task',
  'validation',
  'notification',
  'condition'
);

-- Enum for workflow status
CREATE TYPE public.workflow_status AS ENUM (
  'draft',
  'active',
  'inactive',
  'archived'
);

-- Enum for workflow run status
CREATE TYPE public.workflow_run_status AS ENUM (
  'running',
  'completed',
  'failed',
  'cancelled',
  'paused'
);

-- Enum for validation instance status
CREATE TYPE public.validation_instance_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'expired',
  'skipped'
);

-- Enum for notification channel
CREATE TYPE public.notification_channel AS ENUM (
  'in_app',
  'email',
  'teams'
);

-- =============================================
-- 1. WORKFLOW TEMPLATES
-- =============================================
CREATE TABLE public.workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_template_id UUID REFERENCES public.process_templates(id) ON DELETE CASCADE,
  sub_process_template_id UUID REFERENCES public.sub_process_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  status workflow_status NOT NULL DEFAULT 'draft',
  is_default BOOLEAN NOT NULL DEFAULT false,
  canvas_settings JSONB DEFAULT '{"zoom": 1, "x": 0, "y": 0}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  published_at TIMESTAMP WITH TIME ZONE,
  -- Ensure workflow is linked to either process or sub-process
  CONSTRAINT workflow_template_link_check CHECK (
    (process_template_id IS NOT NULL AND sub_process_template_id IS NULL) OR
    (process_template_id IS NULL AND sub_process_template_id IS NOT NULL)
  )
);

-- Index for quick lookups
CREATE INDEX idx_workflow_templates_process ON public.workflow_templates(process_template_id);
CREATE INDEX idx_workflow_templates_subprocess ON public.workflow_templates(sub_process_template_id);
CREATE INDEX idx_workflow_templates_status ON public.workflow_templates(status);

-- =============================================
-- 2. WORKFLOW NODES
-- =============================================
CREATE TABLE public.workflow_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  node_type workflow_node_type NOT NULL,
  label TEXT NOT NULL,
  position_x DOUBLE PRECISION NOT NULL DEFAULT 0,
  position_y DOUBLE PRECISION NOT NULL DEFAULT 0,
  
  -- Configuration based on node type (JSON)
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- For task nodes: link to task template
  task_template_id UUID REFERENCES public.task_templates(id) ON DELETE SET NULL,
  
  -- Style/appearance
  width DOUBLE PRECISION,
  height DOUBLE PRECISION,
  style JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_workflow_nodes_workflow ON public.workflow_nodes(workflow_id);
CREATE INDEX idx_workflow_nodes_type ON public.workflow_nodes(node_type);
CREATE INDEX idx_workflow_nodes_task ON public.workflow_nodes(task_template_id);

-- =============================================
-- 3. WORKFLOW EDGES (Connections between nodes)
-- =============================================
CREATE TABLE public.workflow_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES public.workflow_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES public.workflow_nodes(id) ON DELETE CASCADE,
  source_handle TEXT, -- For multiple output handles
  target_handle TEXT, -- For multiple input handles
  
  -- For condition nodes: branch label (yes/no, etc.)
  branch_label TEXT,
  condition_expression JSONB, -- Optional condition rules
  
  -- Style
  label TEXT,
  style JSONB DEFAULT '{}'::jsonb,
  animated BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Prevent duplicate edges
  CONSTRAINT unique_edge UNIQUE (workflow_id, source_node_id, target_node_id, source_handle, target_handle)
);

-- Indexes
CREATE INDEX idx_workflow_edges_workflow ON public.workflow_edges(workflow_id);
CREATE INDEX idx_workflow_edges_source ON public.workflow_edges(source_node_id);
CREATE INDEX idx_workflow_edges_target ON public.workflow_edges(target_node_id);

-- =============================================
-- 4. WORKFLOW RUNS (Execution instances)
-- =============================================
CREATE TABLE public.workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflow_templates(id) ON DELETE RESTRICT,
  workflow_version INTEGER NOT NULL,
  
  -- What triggered this run
  trigger_entity_type TEXT NOT NULL, -- 'task', 'request'
  trigger_entity_id UUID NOT NULL,
  
  -- Current state
  status workflow_run_status NOT NULL DEFAULT 'running',
  current_node_id UUID REFERENCES public.workflow_nodes(id) ON DELETE SET NULL,
  
  -- Execution data
  context_data JSONB DEFAULT '{}'::jsonb, -- Variables, form data, etc.
  execution_log JSONB DEFAULT '[]'::jsonb, -- Audit trail
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Who/what started it
  started_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_workflow_runs_workflow ON public.workflow_runs(workflow_id);
CREATE INDEX idx_workflow_runs_status ON public.workflow_runs(status);
CREATE INDEX idx_workflow_runs_entity ON public.workflow_runs(trigger_entity_type, trigger_entity_id);
CREATE INDEX idx_workflow_runs_current_node ON public.workflow_runs(current_node_id);

-- =============================================
-- 5. VALIDATION INSTANCES
-- =============================================
CREATE TABLE public.workflow_validation_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES public.workflow_nodes(id) ON DELETE CASCADE,
  
  -- Who needs to approve
  approver_type TEXT NOT NULL, -- 'user', 'role', 'group', 'requester_manager', 'target_manager', 'department'
  approver_id UUID, -- profile_id, group_id, department_id, etc.
  approver_role TEXT, -- Role name if approver_type = 'role'
  
  -- Status and response
  status validation_instance_status NOT NULL DEFAULT 'pending',
  decision_comment TEXT,
  decided_by UUID REFERENCES public.profiles(id),
  decided_at TIMESTAMP WITH TIME ZONE,
  
  -- SLA tracking
  due_at TIMESTAMP WITH TIME ZONE,
  reminded_at TIMESTAMP WITH TIME ZONE,
  reminder_count INTEGER DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_validation_instances_run ON public.workflow_validation_instances(run_id);
CREATE INDEX idx_validation_instances_node ON public.workflow_validation_instances(node_id);
CREATE INDEX idx_validation_instances_status ON public.workflow_validation_instances(status);
CREATE INDEX idx_validation_instances_approver ON public.workflow_validation_instances(approver_type, approver_id);
CREATE INDEX idx_validation_instances_due ON public.workflow_validation_instances(due_at) WHERE status = 'pending';

-- =============================================
-- 6. NOTIFICATION QUEUE
-- =============================================
CREATE TABLE public.workflow_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES public.workflow_nodes(id) ON DELETE CASCADE,
  
  -- Delivery
  channel notification_channel NOT NULL,
  recipient_type TEXT NOT NULL, -- 'user', 'group', 'department', 'email'
  recipient_id UUID,
  recipient_email TEXT,
  
  -- Content
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_workflow_notifications_run ON public.workflow_notifications(run_id);
CREATE INDEX idx_workflow_notifications_status ON public.workflow_notifications(status);
CREATE INDEX idx_workflow_notifications_recipient ON public.workflow_notifications(recipient_type, recipient_id);

-- =============================================
-- 7. WORKFLOW HISTORY (Version tracking)
-- =============================================
CREATE TABLE public.workflow_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  
  -- Snapshot of the workflow at this version
  nodes_snapshot JSONB NOT NULL,
  edges_snapshot JSONB NOT NULL,
  settings_snapshot JSONB,
  
  published_by UUID REFERENCES auth.users(id),
  published_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  change_notes TEXT,
  
  CONSTRAINT unique_workflow_version UNIQUE (workflow_id, version)
);

CREATE INDEX idx_workflow_versions_workflow ON public.workflow_template_versions(workflow_id);

-- =============================================
-- RLS POLICIES
-- =============================================

-- Enable RLS
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_validation_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_template_versions ENABLE ROW LEVEL SECURITY;

-- Workflow Templates policies
CREATE POLICY "Authenticated users can view workflow templates" ON public.workflow_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and template managers can manage workflow templates" ON public.workflow_templates
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN permission_profiles pp ON p.permission_profile_id = pp.id
      WHERE p.user_id = auth.uid() AND pp.can_manage_templates = true
    )
  );

-- Workflow Nodes policies
CREATE POLICY "Authenticated users can view workflow nodes" ON public.workflow_nodes
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage workflow nodes" ON public.workflow_nodes
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN permission_profiles pp ON p.permission_profile_id = pp.id
      WHERE p.user_id = auth.uid() AND pp.can_manage_templates = true
    )
  );

-- Workflow Edges policies
CREATE POLICY "Authenticated users can view workflow edges" ON public.workflow_edges
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage workflow edges" ON public.workflow_edges
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN permission_profiles pp ON p.permission_profile_id = pp.id
      WHERE p.user_id = auth.uid() AND pp.can_manage_templates = true
    )
  );

-- Workflow Runs policies
CREATE POLICY "Users can view their own workflow runs" ON public.workflow_runs
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      started_by = auth.uid() OR
      has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "Admins can manage workflow runs" ON public.workflow_runs
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert workflow runs" ON public.workflow_runs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "System can update workflow runs" ON public.workflow_runs
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Validation Instances policies
CREATE POLICY "Users can view relevant validation instances" ON public.workflow_validation_instances
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      approver_id = current_profile_id() OR
      decided_by = current_profile_id() OR
      has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "Approvers can update their validation instances" ON public.workflow_validation_instances
  FOR UPDATE USING (
    approver_id = current_profile_id() OR
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "System can insert validation instances" ON public.workflow_validation_instances
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Notifications policies
CREATE POLICY "Users can view their notifications" ON public.workflow_notifications
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      recipient_id = current_profile_id() OR
      has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "System can manage notifications" ON public.workflow_notifications
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Versions policies
CREATE POLICY "Authenticated users can view workflow versions" ON public.workflow_template_versions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage workflow versions" ON public.workflow_template_versions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- TRIGGERS
-- =============================================

-- Update timestamps
CREATE TRIGGER update_workflow_templates_updated_at
  BEFORE UPDATE ON public.workflow_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workflow_nodes_updated_at
  BEFORE UPDATE ON public.workflow_nodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workflow_runs_updated_at
  BEFORE UPDATE ON public.workflow_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workflow_validation_instances_updated_at
  BEFORE UPDATE ON public.workflow_validation_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to get active workflow for a process
CREATE OR REPLACE FUNCTION public.get_active_workflow(
  _process_template_id UUID DEFAULT NULL,
  _sub_process_template_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM workflow_templates
  WHERE status = 'active'
    AND is_default = true
    AND (
      (_process_template_id IS NOT NULL AND process_template_id = _process_template_id)
      OR
      (_sub_process_template_id IS NOT NULL AND sub_process_template_id = _sub_process_template_id)
    )
  ORDER BY version DESC
  LIMIT 1
$$;