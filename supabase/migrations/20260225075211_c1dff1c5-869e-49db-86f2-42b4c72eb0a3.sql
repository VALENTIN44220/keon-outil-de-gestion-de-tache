
-- Add two new date fields to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS date_demande TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS date_lancement TIMESTAMP WITH TIME ZONE;

-- Backfill date_demande: for tasks with a parent request, copy the request's created_at
UPDATE public.tasks t
SET date_demande = parent.created_at
FROM public.tasks parent
WHERE t.parent_request_id = parent.id
  AND t.date_demande IS NULL;

-- Backfill date_demande for requests themselves: use their own created_at
UPDATE public.tasks
SET date_demande = created_at
WHERE type = 'request' AND date_demande IS NULL;

-- Backfill date_lancement for tasks already in-progress or beyond
UPDATE public.tasks
SET date_lancement = updated_at
WHERE status IN ('in-progress', 'done', 'validated', 'pending_validation_1', 'pending_validation_2', 'review')
  AND date_lancement IS NULL;

-- Trigger: auto-set date_demande on new tasks from parent request
CREATE OR REPLACE FUNCTION public.set_task_date_demande()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.date_demande IS NULL THEN
    IF NEW.parent_request_id IS NOT NULL THEN
      SELECT created_at INTO NEW.date_demande
      FROM public.tasks WHERE id = NEW.parent_request_id;
    ELSE
      NEW.date_demande := NEW.created_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_task_date_demande
BEFORE INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_task_date_demande();

-- Trigger: auto-set date_lancement when status changes to in-progress
CREATE OR REPLACE FUNCTION public.set_task_date_lancement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'in-progress' AND (OLD.status IS DISTINCT FROM 'in-progress') AND NEW.date_lancement IS NULL THEN
    NEW.date_lancement := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_task_date_lancement
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_task_date_lancement();
