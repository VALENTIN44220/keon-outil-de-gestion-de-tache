-- Add support for parallel workflow execution (fork/join)

-- 1) Add branch tracking to workflow_runs for parallel execution
ALTER TABLE public.workflow_runs 
ADD COLUMN IF NOT EXISTS active_branches JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS completed_branches JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS branch_statuses JSONB DEFAULT '{}'::jsonb;

-- 2) Add branch_id to workflow_validation_instances for parallel branch tracking
ALTER TABLE public.workflow_validation_instances
ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS trigger_mode TEXT DEFAULT 'auto' CHECK (trigger_mode IN ('auto', 'manual')),
ADD COLUMN IF NOT EXISTS triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS triggered_by UUID REFERENCES auth.users(id) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS prerequisites_met BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS prerequisite_config JSONB DEFAULT NULL;

-- 3) Add branch_id to workflow_notifications for parallel branch tracking  
ALTER TABLE public.workflow_notifications
ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT NULL;

-- 4) Create table for tracking individual branch execution
CREATE TABLE IF NOT EXISTS public.workflow_branch_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL,
  fork_node_id UUID REFERENCES public.workflow_nodes(id) ON DELETE SET NULL,
  current_node_id UUID REFERENCES public.workflow_nodes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'waiting', 'paused')),
  context_data JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(run_id, branch_id)
);

-- 5) Enable RLS on branch instances
ALTER TABLE public.workflow_branch_instances ENABLE ROW LEVEL SECURITY;

-- 6) RLS policies for branch instances
CREATE POLICY "Users can view branch instances for their runs"
ON public.workflow_branch_instances
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM workflow_runs wr
    WHERE wr.id = workflow_branch_instances.run_id
    AND (wr.started_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

CREATE POLICY "System can manage branch instances"
ON public.workflow_branch_instances
FOR ALL
USING (auth.uid() IS NOT NULL);

-- 7) Create index for efficient branch queries
CREATE INDEX IF NOT EXISTS idx_workflow_branch_instances_run_id ON public.workflow_branch_instances(run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_branch_instances_status ON public.workflow_branch_instances(status);

-- 8) Add trigger for updated_at
CREATE TRIGGER update_workflow_branch_instances_updated_at
  BEFORE UPDATE ON public.workflow_branch_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();