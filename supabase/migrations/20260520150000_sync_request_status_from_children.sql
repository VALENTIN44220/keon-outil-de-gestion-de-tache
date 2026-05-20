-- ════════════════════════════════════════════════════════════════════════
-- Synchronise tasks.status d'une demande depuis le status agrégé de ses
-- tâches enfant. Résout la désync genre « demande livrée » mais tâches
-- enfant encore « à faire ».
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_sync_request_status_from_children()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_parent_id uuid;
  v_parent RECORD;
  v_total int;
  v_active int;
  v_done int;
  v_cancelled int;
  v_new_status text;
BEGIN
  IF NEW.type IS DISTINCT FROM 'task' THEN RETURN NEW; END IF;
  IF NEW.parent_request_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN RETURN NEW; END IF;

  v_parent_id := NEW.parent_request_id;

  SELECT * INTO v_parent FROM tasks WHERE id = v_parent_id;
  IF NOT FOUND OR v_parent.type IS DISTINCT FROM 'request' THEN RETURN NEW; END IF;

  -- BE est piloté par be_status (autre logique)
  IF v_parent.module_code = 'be'::module_code THEN RETURN NEW; END IF;

  -- Ne touche pas une demande clôturée manuellement
  IF v_parent.status IN ('cancelled') THEN RETURN NEW; END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('in-progress','affectee','en_cours','a_relire','a_valider','pending_validation_1','pending_validation_2','review')),
    COUNT(*) FILTER (WHERE status IN ('done','validated','realisee','cloturee')),
    COUNT(*) FILTER (WHERE status = 'cancelled')
  INTO v_total, v_active, v_done, v_cancelled
  FROM tasks
  WHERE parent_request_id = v_parent_id AND type = 'task';

  IF v_total = 0 THEN RETURN NEW; END IF;

  v_new_status := CASE
    WHEN v_cancelled = v_total                             THEN 'cancelled'
    WHEN (v_done + v_cancelled) = v_total                  THEN 'done'
    WHEN v_active > 0                                      THEN 'in-progress'
    ELSE 'todo'
  END;

  IF v_new_status IS DISTINCT FROM v_parent.status THEN
    UPDATE tasks SET status = v_new_status, updated_at = NOW() WHERE id = v_parent_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_request_status_from_children ON tasks;
CREATE TRIGGER trg_sync_request_status_from_children
AFTER UPDATE OF status ON tasks
FOR EACH ROW
EXECUTE FUNCTION fn_sync_request_status_from_children();
