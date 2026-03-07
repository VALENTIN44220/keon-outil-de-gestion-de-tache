-- Add date_fermeture column to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS date_fermeture TIMESTAMPTZ;

-- Create trigger to auto-set date_fermeture when status changes to done/validated/cancelled
CREATE OR REPLACE FUNCTION public.set_task_date_fermeture()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IN ('done', 'validated', 'cancelled') 
     AND (OLD.status IS DISTINCT FROM NEW.status) 
     AND NEW.date_fermeture IS NULL THEN
    NEW.date_fermeture := now();
  END IF;
  
  IF NEW.status NOT IN ('done', 'validated', 'cancelled') 
     AND OLD.status IN ('done', 'validated', 'cancelled') THEN
    NEW.date_fermeture := NULL;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_set_task_date_fermeture
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_task_date_fermeture();

-- Backfill for non-Planner completed tasks
UPDATE public.tasks 
SET date_fermeture = updated_at
WHERE status IN ('done', 'validated', 'cancelled') 
  AND date_fermeture IS NULL
  AND id NOT IN (SELECT local_task_id FROM planner_task_links);