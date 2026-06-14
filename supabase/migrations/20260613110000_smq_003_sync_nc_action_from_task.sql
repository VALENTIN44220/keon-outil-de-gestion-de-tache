-- SMQ 003 — Synchronise l'état d'une action NC depuis sa tâche liée.
-- Bug corrigé : nc_actions.linked_task_id était posé à la création de la tâche,
-- mais le statut de l'action ne suivait jamais la tâche (action figée en todo/
-- in_progress même quand la tâche liée était terminée).
CREATE OR REPLACE FUNCTION public.fn_sync_nc_action_from_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.nc_actions
       SET status = CASE
         WHEN NEW.status IN ('done','validated','cloturee','realisee') THEN 'done'
         WHEN NEW.status IN ('in-progress','pending_validation_1','pending_validation_2','review') THEN 'in_progress'
         ELSE 'todo'
       END,
       updated_at = now()
     WHERE linked_task_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_nc_action_from_task ON public.tasks;
CREATE TRIGGER trg_sync_nc_action_from_task
  AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_nc_action_from_task();

-- Backfill : aligne les actions déjà liées à une tâche existante.
UPDATE public.nc_actions a
   SET status = CASE
     WHEN t.status IN ('done','validated','cloturee','realisee') THEN 'done'
     WHEN t.status IN ('in-progress','pending_validation_1','pending_validation_2','review') THEN 'in_progress'
     ELSE 'todo'
   END,
   updated_at = now()
  FROM public.tasks t
 WHERE a.linked_task_id = t.id
   AND a.status IS DISTINCT FROM CASE
     WHEN t.status IN ('done','validated','cloturee','realisee') THEN 'done'
     WHEN t.status IN ('in-progress','pending_validation_1','pending_validation_2','review') THEN 'in_progress'
     ELSE 'todo'
   END;
