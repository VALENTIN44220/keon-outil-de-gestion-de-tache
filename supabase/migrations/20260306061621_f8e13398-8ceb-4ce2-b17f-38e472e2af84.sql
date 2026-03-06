
-- ===========================================
-- wf_task_configs: Task templates within a workflow step
-- ===========================================
CREATE TABLE public.wf_task_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.wf_workflows(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  task_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_required BOOLEAN NOT NULL DEFAULT true,

  -- Executor
  executor_type TEXT NOT NULL DEFAULT 'manual',
  -- values: specific_user, requester, requester_manager, role, manual, field_value
  executor_value TEXT, -- user_id, role name, field key depending on type

  -- Assignment
  assignment_mode TEXT NOT NULL DEFAULT 'direct',
  -- values: direct, round_robin, least_loaded

  -- Trigger
  trigger_mode TEXT NOT NULL DEFAULT 'on_step_entry',
  -- values: on_step_entry, after_task, after_validation, on_condition, on_step_exit
  trigger_task_key TEXT, -- for after_task
  trigger_condition_json JSONB,

  -- Initial status
  initial_status TEXT NOT NULL DEFAULT 'todo',

  -- Completion behavior
  completion_behavior TEXT NOT NULL DEFAULT 'close_task',
  -- values: close_task, close_and_advance_step, close_and_goto_step, send_to_validation, create_task, trigger_action, wait_validation, stay_on_step
  completion_target_step_key TEXT,
  completion_target_task_key TEXT,
  completion_action_id UUID,

  -- Validation link
  validation_config_id UUID, -- will reference wf_validation_configs

  -- Outcome behaviors (JSON: maps outcome -> effect)
  outcome_behaviors_json JSONB DEFAULT '{}'::jsonb,
  -- Example: { "done": { "effect": "advance_step" }, "refused": { "effect": "goto_step", "target": "review_step" }, "cancelled": { "effect": "stay" } }

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(workflow_id, task_key)
);

-- Trigger for updated_at
CREATE TRIGGER wf_task_configs_updated_at
  BEFORE UPDATE ON public.wf_task_configs
  FOR EACH ROW EXECUTE FUNCTION public.wf_update_updated_at();

-- RLS
ALTER TABLE public.wf_task_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read wf_task_configs"
  ON public.wf_task_configs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage wf_task_configs"
  ON public.wf_task_configs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===========================================
-- wf_validation_configs: Validation definitions within a workflow
-- ===========================================
CREATE TABLE public.wf_validation_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.wf_workflows(id) ON DELETE CASCADE,
  validation_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,

  -- What is being validated
  object_type TEXT NOT NULL DEFAULT 'task',
  -- values: request, task, step, deliverable

  -- Source
  source_step_key TEXT,
  source_task_key TEXT,

  -- Validator
  validator_type TEXT NOT NULL DEFAULT 'requester_manager',
  -- values: specific_user, requester, requester_manager, role, group, department
  validator_value TEXT, -- user_id, role name, group_id, department_id

  -- Validation mode
  validation_mode TEXT NOT NULL DEFAULT 'simple',
  -- values: simple, n_of_m, sequence, unanimous
  n_required INTEGER,

  -- Condition
  condition_json JSONB,

  -- Behavior on approved
  on_approved_effect TEXT NOT NULL DEFAULT 'advance_step',
  -- values: advance_step, goto_step, close_task, create_task, trigger_action
  on_approved_target_step_key TEXT,

  -- Behavior on rejected
  on_rejected_effect TEXT NOT NULL DEFAULT 'return_to_task',
  -- values: return_to_task, goto_step, cancel_task, reassign
  on_rejected_target_step_key TEXT,

  -- Target step (generic fallback)
  target_step_key TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(workflow_id, validation_key)
);

-- Trigger for updated_at
CREATE TRIGGER wf_validation_configs_updated_at
  BEFORE UPDATE ON public.wf_validation_configs
  FOR EACH ROW EXECUTE FUNCTION public.wf_update_updated_at();

-- RLS
ALTER TABLE public.wf_validation_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read wf_validation_configs"
  ON public.wf_validation_configs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage wf_validation_configs"
  ON public.wf_validation_configs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add FK from wf_task_configs to wf_validation_configs
ALTER TABLE public.wf_task_configs
  ADD CONSTRAINT wf_task_configs_validation_config_fk
  FOREIGN KEY (validation_config_id) REFERENCES public.wf_validation_configs(id) ON DELETE SET NULL;
