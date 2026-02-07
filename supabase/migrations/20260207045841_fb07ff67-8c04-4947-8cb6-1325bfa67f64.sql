-- Fix FK violations when creating requests/tasks: trace rows were inserted in BEFORE INSERT triggers
-- which runs before the referenced row exists, so FK checks fail.

BEGIN;

-- 1) Create AFTER INSERT trigger function for tasks trace rows
CREATE OR REPLACE FUNCTION public.insert_task_trace_number_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project_code text;
  v_request_number text;
BEGIN
  -- Derive project code the same way as assign_task_number
  v_project_code := public.get_project_code_for_entity(NEW.be_project_id, NEW.parent_request_id);
  IF v_project_code IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.type = 'request' THEN
    IF NEW.request_number IS NOT NULL THEN
      INSERT INTO public.request_trace_numbers (project_code, request_id, request_number)
      VALUES (v_project_code, NEW.id, NEW.request_number);
    END IF;

  ELSIF NEW.type = 'task' THEN
    -- Link to parent request if any
    SELECT t.request_number
    INTO v_request_number
    FROM public.tasks t
    WHERE t.id = NEW.parent_request_id;

    IF NEW.task_number IS NOT NULL THEN
      INSERT INTO public.request_trace_numbers (
        project_code,
        task_id,
        task_number,
        request_id,
        request_number
      )
      VALUES (
        v_project_code,
        NEW.id,
        NEW.task_number,
        NEW.parent_request_id,
        v_request_number
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Create AFTER INSERT trigger function for request_sub_processes trace rows
CREATE OR REPLACE FUNCTION public.insert_sub_process_trace_number_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project_code text;
  v_request_number text;
BEGIN
  -- Get project code via parent request
  SELECT bp.code_projet, t.request_number
  INTO v_project_code, v_request_number
  FROM public.tasks t
  LEFT JOIN public.be_projects bp ON bp.id = t.be_project_id
  WHERE t.id = NEW.request_id;

  IF v_project_code IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.sub_process_number IS NOT NULL THEN
    INSERT INTO public.request_trace_numbers (
      project_code,
      sub_process_instance_id,
      sub_process_number,
      request_id,
      request_number
    )
    VALUES (
      v_project_code,
      NEW.id,
      NEW.sub_process_number,
      NEW.request_id,
      v_request_number
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Remove trace inserts from BEFORE triggers (keep numbering/title mutation)
CREATE OR REPLACE FUNCTION public.assign_task_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project_code text;
  v_entity_type text;
  v_number text;
BEGIN
  v_project_code := public.get_project_code_for_entity(NEW.be_project_id, NEW.parent_request_id);
  IF v_project_code IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.type = 'request' THEN
    v_entity_type := 'request';

    IF NEW.request_number IS NULL THEN
      v_number := public.next_entity_number(v_project_code, v_entity_type);
      NEW.request_number := v_number;

      IF NEW.title IS NOT NULL AND NOT NEW.title LIKE v_number || ' — %' AND NOT NEW.title LIKE v_number || '%' THEN
        NEW.title := v_number || ' — ' || NEW.title;
      ELSIF NEW.title IS NULL OR NEW.title = '' THEN
        NEW.title := v_number;
      END IF;
    END IF;

  ELSIF NEW.type = 'task' THEN
    v_entity_type := 'task';

    IF NEW.task_number IS NULL THEN
      v_number := public.next_entity_number(v_project_code, v_entity_type);
      NEW.task_number := v_number;

      IF NEW.title IS NOT NULL AND NOT NEW.title LIKE v_number || ' — %' AND NOT NEW.title LIKE v_number || '%' THEN
        NEW.title := v_number || ' — ' || NEW.title;
      ELSIF NEW.title IS NULL OR NEW.title = '' THEN
        NEW.title := v_number;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_sub_process_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project_code text;
  v_number text;
BEGIN
  SELECT bp.code_projet
  INTO v_project_code
  FROM public.tasks t
  LEFT JOIN public.be_projects bp ON bp.id = t.be_project_id
  WHERE t.id = NEW.request_id;

  IF v_project_code IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.sub_process_number IS NULL THEN
    v_number := public.next_entity_number(v_project_code, 'sub_process');
    NEW.sub_process_number := v_number;
  END IF;

  RETURN NEW;
END;
$$;

-- 4) Ensure AFTER INSERT triggers exist (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_insert_task_trace_number'
  ) THEN
    CREATE TRIGGER trg_insert_task_trace_number
    AFTER INSERT ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.insert_task_trace_number_after_insert();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_insert_sub_process_trace_number'
  ) THEN
    CREATE TRIGGER trg_insert_sub_process_trace_number
    AFTER INSERT ON public.request_sub_processes
    FOR EACH ROW
    EXECUTE FUNCTION public.insert_sub_process_trace_number_after_insert();
  END IF;
END $$;

COMMIT;