-- Table pour stocker les affectations de tâches en attente (avant génération)
CREATE TABLE public.pending_task_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  task_template_id UUID NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE,
  process_template_id UUID REFERENCES public.process_templates(id) ON DELETE SET NULL,
  sub_process_template_id UUID REFERENCES public.sub_process_templates(id) ON DELETE SET NULL,
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'created')),
  assigned_at TIMESTAMPTZ,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pending_task_assignments ENABLE ROW LEVEL SECURITY;

-- Index for faster lookups
CREATE INDEX idx_pending_task_assignments_request_id ON public.pending_task_assignments(request_id);
CREATE INDEX idx_pending_task_assignments_status ON public.pending_task_assignments(status);

-- RLS: Users can view pending assignments for their department or that they created
CREATE POLICY "Users can view pending assignments for their department"
  ON public.pending_task_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = pending_task_assignments.request_id
      AND (
        t.target_department_id = current_department_id()
        OR t.user_id = auth.uid()
        OR t.requester_id = current_profile_id()
      )
    )
  );

-- RLS: Managers/admins can update pending assignments (use correct has_role signature)
CREATE POLICY "Managers can update pending assignments"
  ON public.pending_task_assignments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = pending_task_assignments.request_id
      AND (
        t.target_department_id = current_department_id()
        OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
      )
    )
  );

-- RLS: System can insert pending assignments
CREATE POLICY "Authenticated users can insert pending assignments"
  ON public.pending_task_assignments
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- RLS: Delete policy for cleanup
CREATE POLICY "Managers can delete pending assignments"
  ON public.pending_task_assignments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = pending_task_assignments.request_id
      AND (
        t.target_department_id = current_department_id()
        OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
      )
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_pending_task_assignments_updated_at
  BEFORE UPDATE ON public.pending_task_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();