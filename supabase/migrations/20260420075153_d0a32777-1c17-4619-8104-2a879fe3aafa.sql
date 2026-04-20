-- Function to clean up duplicate planner_task_links for a given mapping.
-- A "duplicate" here means: multiple local tasks linked to the same planner_task_id
-- for the same plan_mapping_id. We keep the OLDEST link (and its task) and delete the rest.
CREATE OR REPLACE FUNCTION public.cleanup_planner_duplicates_for_mapping(p_plan_mapping_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_links int := 0;
  v_deleted_tasks int := 0;
  v_caller_user uuid;
  v_mapping_owner uuid;
BEGIN
  v_caller_user := auth.uid();
  IF v_caller_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id INTO v_mapping_owner
  FROM public.planner_plan_mappings
  WHERE id = p_plan_mapping_id;

  IF v_mapping_owner IS NULL THEN
    RAISE EXCEPTION 'Plan mapping not found';
  END IF;

  IF v_mapping_owner <> v_caller_user
     AND NOT public.has_role(v_caller_user, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Identify duplicates: keep MIN(created_at) per planner_task_id, delete others
  WITH ranked AS (
    SELECT
      id,
      local_task_id,
      planner_task_id,
      ROW_NUMBER() OVER (
        PARTITION BY plan_mapping_id, planner_task_id
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM public.planner_task_links
    WHERE plan_mapping_id = p_plan_mapping_id
  ),
  to_delete AS (
    SELECT id, local_task_id
    FROM ranked
    WHERE rn > 1
  ),
  del_tasks AS (
    DELETE FROM public.tasks t
    USING to_delete d
    WHERE t.id = d.local_task_id
    RETURNING t.id
  ),
  del_links AS (
    DELETE FROM public.planner_task_links l
    USING to_delete d
    WHERE l.id = d.id
    RETURNING l.id
  )
  SELECT
    (SELECT count(*) FROM del_links),
    (SELECT count(*) FROM del_tasks)
  INTO v_deleted_links, v_deleted_tasks;

  RETURN jsonb_build_object(
    'deleted_links', v_deleted_links,
    'deleted_tasks', v_deleted_tasks
  );
END;
$$;

-- Unique index to PREVENT future duplicates (one local task per planner_task_id per mapping)
CREATE UNIQUE INDEX IF NOT EXISTS planner_task_links_mapping_planner_task_unique
  ON public.planner_task_links (plan_mapping_id, planner_task_id);