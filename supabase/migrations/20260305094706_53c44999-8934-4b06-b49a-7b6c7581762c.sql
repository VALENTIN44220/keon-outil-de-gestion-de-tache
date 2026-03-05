
-- Add fallback assignment columns and watcher columns to sub_process_templates
ALTER TABLE public.sub_process_templates
  ADD COLUMN IF NOT EXISTS fallback_assignment_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fallback_target_assignee_id uuid REFERENCES public.profiles(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fallback_target_group_id uuid REFERENCES public.collaborator_groups(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fallback_target_department_id uuid REFERENCES public.departments(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fallback_target_job_title_id uuid REFERENCES public.job_titles(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS watcher_config jsonb DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.sub_process_templates.fallback_assignment_type IS 'Fallback assignment type when primary assignment cannot be resolved (e.g. manager absent)';
COMMENT ON COLUMN public.sub_process_templates.watcher_config IS 'JSON array of watcher rules: [{type: "group"|"user"|"requester"|"department", target_id: uuid|null}]';
