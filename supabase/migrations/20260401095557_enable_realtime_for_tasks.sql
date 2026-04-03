-- Expose public.tasks on supabase_realtime (idempotent if already added).

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END;
$$;
