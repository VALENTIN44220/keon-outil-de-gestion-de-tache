CREATE OR REPLACE FUNCTION public.detect_planner_title_duplicates(p_plan_mapping_id uuid)
 RETURNS TABLE(clean_title text, task_ids uuid[], titles text[], task_numbers text[], created_dates timestamp with time zone[], count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid;
  v_owner uuid;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id INTO v_owner FROM public.planner_plan_mappings WHERE id = p_plan_mapping_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Plan mapping not found';
  END IF;
  IF v_owner <> v_user AND NOT public.has_role(v_user, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  WITH candidate_tasks AS (
    SELECT
      t.id AS t_id,
      t.title AS t_title,
      t.task_number AS t_task_number,
      t.created_at AS t_created_at,
      trim(public.clean_planner_task_title(t.title)) AS t_cleaned
    FROM public.tasks t
    WHERE t.user_id = v_owner
      AND t.title IS NOT NULL
  ),
  normalized AS (
    SELECT
      t_id,
      t_title,
      t_task_number,
      t_created_at,
      trim(regexp_replace(t_cleaned, '^T-[A-Z]+-[0-9]+ — ', '')) AS t_cleaned
    FROM candidate_tasks
  ),
  grouped AS (
    SELECT
      lower(t_cleaned) AS clean_key,
      t_cleaned AS g_clean_title,
      array_agg(t_id ORDER BY t_created_at ASC) AS g_task_ids,
      array_agg(t_title ORDER BY t_created_at ASC) AS g_titles,
      array_agg(t_task_number ORDER BY t_created_at ASC) AS g_task_numbers,
      array_agg(t_created_at ORDER BY t_created_at ASC) AS g_created_dates,
      count(*)::int AS g_cnt
    FROM normalized
    WHERE t_cleaned IS NOT NULL AND length(t_cleaned) > 0
    GROUP BY lower(t_cleaned), t_cleaned
    HAVING count(*) > 1
  )
  SELECT g_clean_title, g_task_ids, g_titles, g_task_numbers, g_created_dates, g_cnt
  FROM grouped
  ORDER BY g_cnt DESC, g_clean_title ASC;
END;
$function$;