-- ============================================================
-- BE 009 — Corrige le trigger record_task_status_transition
-- ============================================================
-- Bug : la migration be_001_drop_wf_tables a supprimé la table
-- workflow_events. Mais le trigger trigger_task_status_transition
-- sur tasks (AFTER UPDATE) appelle public.emit_workflow_event qui
-- INSERT INTO workflow_events. Du coup TOUT UPDATE sur tasks échoue
-- avec « relation public.workflow_events does not exist » → blocage
-- des annulations, complétions, transitions de statut...
--
-- Fix :
--  1. Réécrire la fonction record_task_status_transition pour ne
--     plus appeler emit_workflow_event. On garde juste l'enregistrement
--     dans task_status_transitions (utile pour l'audit).
--  2. Supprimer la fonction emit_workflow_event (orpheline).
-- ============================================================

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
    -- NOTE : appel emit_workflow_event retiré (workflow_events table
    -- supprimée par be_001_drop_wf_tables). L'audit reste assuré par
    -- la table task_status_transitions ci-dessus.
  END IF;
  RETURN NEW;
END;
$$;

-- Suppression de la fonction orpheline (plus appelée nulle part)
DROP FUNCTION IF EXISTS public.emit_workflow_event(text, text, uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.emit_workflow_event(text, text, uuid, jsonb);
