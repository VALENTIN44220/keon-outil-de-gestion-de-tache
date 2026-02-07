-- Secure internal counters table: RLS is enabled but no policies exist
-- We deny all direct access; access should only happen via SECURITY DEFINER functions.

BEGIN;

ALTER TABLE public.number_counters ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='number_counters' AND policyname='Deny all select on number_counters'
  ) THEN
    CREATE POLICY "Deny all select on number_counters"
    ON public.number_counters
    FOR SELECT
    USING (false);
  END IF;

  -- INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='number_counters' AND policyname='Deny all insert on number_counters'
  ) THEN
    CREATE POLICY "Deny all insert on number_counters"
    ON public.number_counters
    FOR INSERT
    WITH CHECK (false);
  END IF;

  -- UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='number_counters' AND policyname='Deny all update on number_counters'
  ) THEN
    CREATE POLICY "Deny all update on number_counters"
    ON public.number_counters
    FOR UPDATE
    USING (false);
  END IF;

  -- DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='number_counters' AND policyname='Deny all delete on number_counters'
  ) THEN
    CREATE POLICY "Deny all delete on number_counters"
    ON public.number_counters
    FOR DELETE
    USING (false);
  END IF;
END $$;

COMMIT;