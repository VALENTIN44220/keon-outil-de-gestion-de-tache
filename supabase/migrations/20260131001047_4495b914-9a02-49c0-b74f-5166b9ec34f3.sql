-- =============================================================================
-- PHASE 1: Table générique request_sub_processes + Système événementiel unifié
-- =============================================================================

-- 1. Créer la table générique request_sub_processes (remplace be_request_sub_processes)
CREATE TABLE IF NOT EXISTS public.request_sub_processes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  sub_process_template_id UUID NOT NULL REFERENCES public.sub_process_templates(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  workflow_run_id UUID REFERENCES public.workflow_runs(id) ON DELETE SET NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(request_id, sub_process_template_id)
);

-- Index pour performance
CREATE INDEX idx_request_sub_processes_request ON public.request_sub_processes(request_id);
CREATE INDEX idx_request_sub_processes_status ON public.request_sub_processes(status);
CREATE INDEX idx_request_sub_processes_template ON public.request_sub_processes(sub_process_template_id);

-- RLS
ALTER TABLE public.request_sub_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view request sub-processes for accessible requests"
  ON public.request_sub_processes FOR SELECT
  USING (public.can_access_task(request_id));

CREATE POLICY "Authenticated users can insert request sub-processes"
  ON public.request_sub_processes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own request sub-processes"
  ON public.request_sub_processes FOR UPDATE
  USING (public.can_access_task(request_id));

-- Trigger updated_at
CREATE TRIGGER update_request_sub_processes_updated_at
  BEFORE UPDATE ON public.request_sub_processes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Migrer les données depuis be_request_sub_processes (si elle existe et a des données)
INSERT INTO public.request_sub_processes (request_id, sub_process_template_id, created_at)
SELECT task_id, sub_process_template_id, created_at
FROM public.be_request_sub_processes
ON CONFLICT (request_id, sub_process_template_id) DO NOTHING;

-- 3. Créer la table workflow_events pour le système événementiel unifié
CREATE TABLE IF NOT EXISTS public.workflow_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'request_created',
    'request_updated', 
    'task_created',
    'task_assigned',
    'task_to_assign',
    'task_status_changed',
    'task_completed',
    'validation_requested',
    'validation_decided',
    'sub_process_started',
    'sub_process_completed',
    'process_completed',
    'checklist_item_completed',
    'comment_added',
    'reminder_triggered'
  )),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('task', 'request', 'workflow_run', 'validation')),
  entity_id UUID NOT NULL,
  run_id UUID REFERENCES public.workflow_runs(id) ON DELETE SET NULL,
  triggered_by UUID,
  payload JSONB NOT NULL DEFAULT '{}',
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour traitement des événements
CREATE INDEX idx_workflow_events_unprocessed ON public.workflow_events(processed, created_at) WHERE processed = false;
CREATE INDEX idx_workflow_events_entity ON public.workflow_events(entity_type, entity_id);
CREATE INDEX idx_workflow_events_run ON public.workflow_events(run_id);
CREATE INDEX idx_workflow_events_type ON public.workflow_events(event_type);

-- RLS
ALTER TABLE public.workflow_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all workflow events"
  ON public.workflow_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "System can insert workflow events"
  ON public.workflow_events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Créer la table task_status_transitions pour historique et règles
CREATE TABLE IF NOT EXISTS public.task_status_transitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  changed_by UUID,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_status_transitions_task ON public.task_status_transitions(task_id);
CREATE INDEX idx_task_status_transitions_created ON public.task_status_transitions(created_at DESC);

-- RLS
ALTER TABLE public.task_status_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transitions for accessible tasks"
  ON public.task_status_transitions FOR SELECT
  USING (public.can_access_task(task_id));

CREATE POLICY "Authenticated users can insert transitions"
  ON public.task_status_transitions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 5. Créer la table notification_preferences (préférences utilisateur)
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'teams')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  frequency TEXT DEFAULT 'immediate' CHECK (frequency IN ('immediate', 'hourly', 'daily', 'weekly')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_type, channel)
);

CREATE INDEX idx_notification_preferences_user ON public.notification_preferences(user_id);

-- RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notification preferences"
  ON public.notification_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own notification preferences"
  ON public.notification_preferences FOR ALL
  USING (user_id = auth.uid());

-- 6. Créer la table workflow_execution_logs pour audit détaillé
CREATE TABLE IF NOT EXISTS public.workflow_execution_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  node_id TEXT,
  action TEXT NOT NULL,
  actor_id UUID,
  details JSONB DEFAULT '{}',
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_execution_logs_run ON public.workflow_execution_logs(run_id, created_at);
CREATE INDEX idx_workflow_execution_logs_action ON public.workflow_execution_logs(action);

-- RLS
ALTER TABLE public.workflow_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view logs for accessible runs"
  ON public.workflow_execution_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.workflow_runs wr 
    WHERE wr.id = run_id 
    AND public.can_access_task(wr.trigger_entity_id)
  ));

CREATE POLICY "System can insert execution logs"
  ON public.workflow_execution_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 7. Ajouter colonnes manquantes aux tables existantes

-- Ajouter process_template_id à tasks pour lien direct
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS process_template_id UUID REFERENCES public.process_templates(id) ON DELETE SET NULL;

-- Ajouter workflow_run_id à tasks pour traçabilité
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS workflow_run_id UUID REFERENCES public.workflow_runs(id) ON DELETE SET NULL;

-- Ajouter parent_sub_process_id pour lier tâches à leur sous-processus d'exécution
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS parent_sub_process_run_id UUID REFERENCES public.request_sub_processes(id) ON DELETE SET NULL;

-- Index pour les nouvelles colonnes
CREATE INDEX IF NOT EXISTS idx_tasks_process_template ON public.tasks(process_template_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workflow_run ON public.tasks(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_sp_run ON public.tasks(parent_sub_process_run_id);

-- 8. Vue pour obtenir l'état complet d'une demande avec ses sous-processus
CREATE OR REPLACE VIEW public.request_progress_view AS
SELECT 
  r.id as request_id,
  r.title as request_title,
  r.status as request_status,
  r.created_at as request_created_at,
  rsp.id as sub_process_run_id,
  rsp.status as sub_process_status,
  spt.id as sub_process_template_id,
  spt.name as sub_process_name,
  spt.order_index as sub_process_order,
  COUNT(t.id) as task_count,
  COUNT(CASE WHEN t.status = 'done' OR t.status = 'validated' THEN 1 END) as completed_task_count,
  CASE 
    WHEN COUNT(t.id) = 0 THEN 0
    ELSE ROUND(100.0 * COUNT(CASE WHEN t.status = 'done' OR t.status = 'validated' THEN 1 END) / COUNT(t.id))
  END as progress_percent
FROM public.tasks r
LEFT JOIN public.request_sub_processes rsp ON rsp.request_id = r.id
LEFT JOIN public.sub_process_templates spt ON spt.id = rsp.sub_process_template_id
LEFT JOIN public.tasks t ON t.parent_request_id = r.id AND t.source_sub_process_template_id = spt.id
WHERE r.type = 'request'
GROUP BY r.id, r.title, r.status, r.created_at, rsp.id, rsp.status, spt.id, spt.name, spt.order_index;

-- 9. Fonction pour émettre un événement workflow
CREATE OR REPLACE FUNCTION public.emit_workflow_event(
  p_event_type TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_run_id UUID DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO public.workflow_events (
    event_type,
    entity_type,
    entity_id,
    run_id,
    triggered_by,
    payload
  ) VALUES (
    p_event_type,
    p_entity_type,
    p_entity_id,
    p_run_id,
    auth.uid(),
    p_payload
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- 10. Fonction pour enregistrer une transition de statut
CREATE OR REPLACE FUNCTION public.record_task_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.task_status_transitions (
      task_id,
      from_status,
      to_status,
      changed_by,
      metadata
    ) VALUES (
      NEW.id,
      COALESCE(OLD.status, 'none'),
      NEW.status,
      auth.uid(),
      jsonb_build_object(
        'old_assignee_id', OLD.assignee_id,
        'new_assignee_id', NEW.assignee_id
      )
    );
    
    -- Émettre l'événement
    PERFORM public.emit_workflow_event(
      'task_status_changed',
      'task',
      NEW.id,
      NEW.workflow_run_id,
      jsonb_build_object(
        'from_status', COALESCE(OLD.status, 'none'),
        'to_status', NEW.status,
        'task_type', NEW.type
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger pour enregistrer les transitions
DROP TRIGGER IF EXISTS trigger_task_status_transition ON public.tasks;
CREATE TRIGGER trigger_task_status_transition
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.record_task_status_transition();

-- 11. Fonction pour valider les transitions de statut
CREATE OR REPLACE FUNCTION public.validate_task_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_valid_transitions JSONB := '{
    "to_assign": ["todo", "cancelled"],
    "todo": ["in-progress", "to_assign", "cancelled"],
    "in-progress": ["done", "todo", "pending_validation_1", "review", "cancelled"],
    "pending_validation_1": ["pending_validation_2", "validated", "refused", "review"],
    "pending_validation_2": ["validated", "refused", "review"],
    "validated": ["done"],
    "refused": ["todo", "review", "cancelled"],
    "review": ["todo", "in-progress"],
    "done": []
  }'::JSONB;
  v_allowed_targets JSONB;
BEGIN
  -- Skip si pas de changement de statut
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Obtenir les transitions valides depuis l'ancien statut
  v_allowed_targets := v_valid_transitions -> OLD.status;
  
  -- Vérifier si la transition est autorisée
  IF v_allowed_targets IS NOT NULL AND NOT (v_allowed_targets ? NEW.status) THEN
    -- Log l'erreur mais ne bloque pas (pour compatibilité)
    RAISE WARNING 'Transition de statut non standard: % -> %', OLD.status, NEW.status;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger de validation (warning seulement, ne bloque pas)
DROP TRIGGER IF EXISTS trigger_validate_task_status ON public.tasks;
CREATE TRIGGER trigger_validate_task_status
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_task_status_transition();