-- Align trace insert for tasks with production: avoid propagating parent request_number
-- into trace rows when it causes uniqueness / conflict issues.

CREATE OR REPLACE FUNCTION public.insert_task_trace_number_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_code text;
BEGIN
  v_project_code := public.get_project_code_for_entity(NEW.be_project_id, NEW.parent_request_id);

  IF v_project_code IS NULL THEN
    v_project_code := 'PERSO';
  END IF;

  IF NEW.type = 'request' THEN
    IF NEW.request_number IS NOT NULL THEN
      INSERT INTO public.request_trace_numbers (project_code, request_id, request_number)
      VALUES (v_project_code, NEW.id, NEW.request_number)
      ON CONFLICT DO NOTHING;
    END IF;

  ELSIF NEW.type = 'task' THEN
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
        NULL
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
