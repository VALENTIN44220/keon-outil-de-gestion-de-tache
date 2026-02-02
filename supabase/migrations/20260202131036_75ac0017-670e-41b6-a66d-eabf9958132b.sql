-- Cancel a request and cascade to child tasks/sub-processes/workflow runs
-- Uses SECURITY DEFINER to perform a controlled privileged update while still checking access.

CREATE OR REPLACE FUNCTION public.cancel_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Must be able to access the request
  IF NOT public.can_access_task(p_request_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT id, type INTO v_task
  FROM public.tasks
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_task.type IS DISTINCT FROM 'request' THEN
    RAISE EXCEPTION 'Entity is not a request';
  END IF;

  -- 1) Cancel main request
  UPDATE public.tasks
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_request_id;

  -- 2) Cancel all child tasks
  UPDATE public.tasks
  SET status = 'cancelled', updated_at = now()
  WHERE parent_request_id = p_request_id;

  -- 3) Cancel request sub-processes (new model)
  UPDATE public.request_sub_processes
  SET status = 'cancelled', updated_at = now()
  WHERE request_id = p_request_id;

  -- 4) Cancel active workflow runs tied to this request
  UPDATE public.workflow_runs
  SET status = 'cancelled', updated_at = now()
  WHERE trigger_entity_id = p_request_id
    AND status IN ('running', 'paused');
END;
$$;

-- Allow authenticated users to call the function (it still enforces access via can_access_task)
GRANT EXECUTE ON FUNCTION public.cancel_request(uuid) TO authenticated;
