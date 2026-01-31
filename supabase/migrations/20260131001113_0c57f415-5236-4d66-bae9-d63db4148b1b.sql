-- Correction des problèmes de sécurité

-- 1. Supprimer la vue SECURITY DEFINER et la recréer avec SECURITY INVOKER
DROP VIEW IF EXISTS public.request_progress_view;

CREATE VIEW public.request_progress_view 
WITH (security_invoker = on)
AS
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

-- 2. Corriger les fonctions sans search_path

-- Recréer validate_task_status_transition avec search_path
DROP FUNCTION IF EXISTS public.validate_task_status_transition() CASCADE;

CREATE OR REPLACE FUNCTION public.validate_task_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
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

-- Recréer record_task_status_transition avec search_path correct
DROP FUNCTION IF EXISTS public.record_task_status_transition() CASCADE;

CREATE OR REPLACE FUNCTION public.record_task_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO task_status_transitions (
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
    PERFORM emit_workflow_event(
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

-- Recréer les triggers
CREATE TRIGGER trigger_validate_task_status
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_task_status_transition();

CREATE TRIGGER trigger_task_status_transition
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.record_task_status_transition();