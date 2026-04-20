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
    -- TOUTES les tâches du user (pas seulement avec préfixe legacy)
    -- afin de comparer les imports Planner récents avec les tâches déjà existantes
    SELECT
      t.id,
      t.title,
      t.task_number,
      t.created_at,
      trim(public.clean_planner_task_title(t.title)) AS cleaned
    FROM public.tasks t
    WHERE t.user_id = v_owner
      AND t.title IS NOT NULL
  ),
  -- On nettoie aussi le préfixe automatique "T-XXX-NNNN — " standard
  -- (ajouté par le trigger assign_task_number) pour comparer les vrais titres
  normalized AS (
    SELECT
      id,
      title,
      task_number,
      created_at,
      trim(regexp_replace(cleaned, '^T-[A-Z]+-[0-9]+ — ', '')) AS cleaned
    FROM candidate_tasks
  ),
  grouped AS (
    SELECT
      lower(cleaned) AS clean_key,
      cleaned,
      array_agg(id ORDER BY created_at ASC) AS task_ids,
      array_agg(title ORDER BY created_at ASC) AS titles,
      array_agg(task_number ORDER BY created_at ASC) AS task_numbers,
      array_agg(created_at ORDER BY created_at ASC) AS created_dates,
      count(*)::int AS cnt
    FROM normalized
    WHERE cleaned IS NOT NULL AND length(cleaned) > 0
    GROUP BY lower(cleaned), cleaned
    HAVING count(*) > 1
  )
  SELECT cleaned, task_ids, titles, task_numbers, created_dates, cnt
  FROM grouped
  ORDER BY cnt DESC, cleaned ASC;
END;
$function$;