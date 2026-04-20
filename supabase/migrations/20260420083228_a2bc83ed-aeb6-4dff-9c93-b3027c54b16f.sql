-- Utilitaire : extrait le titre Planner réel
CREATE OR REPLACE FUNCTION public.clean_planner_task_title(p_title text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    -- Format complet : "T-PERSO-XXXX — <ID>-/-<bucket>-/-<vrai titre>"
    WHEN p_title ~ '^T-[A-Z]+-[0-9]+ — [0-9]+-/-[^/]+-/-' THEN
      regexp_replace(p_title, '^T-[A-Z]+-[0-9]+ — [0-9]+-/-[^/]*-/-', '')
    -- Format simple : "T-PERSO-XXXX — <vrai titre>"
    WHEN p_title ~ '^T-[A-Z]+-[0-9]+ — ' THEN
      regexp_replace(p_title, '^T-[A-Z]+-[0-9]+ — ', '')
    ELSE
      p_title
  END;
$$;

-- Détection des doublons par titre Planner réel
CREATE OR REPLACE FUNCTION public.detect_planner_title_duplicates(p_plan_mapping_id uuid)
RETURNS TABLE (
  clean_title text,
  task_ids uuid[],
  titles text[],
  task_numbers text[],
  created_dates timestamptz[],
  count int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    -- Tâches du user qui ont un format de titre Planner importé
    SELECT
      t.id,
      t.title,
      t.task_number,
      t.created_at,
      public.clean_planner_task_title(t.title) AS cleaned
    FROM public.tasks t
    WHERE t.user_id = v_owner
      AND t.title ~ '^T-[A-Z]+-[0-9]+ — '
  ),
  grouped AS (
    SELECT
      cleaned,
      array_agg(id ORDER BY created_at ASC) AS task_ids,
      array_agg(title ORDER BY created_at ASC) AS titles,
      array_agg(task_number ORDER BY created_at ASC) AS task_numbers,
      array_agg(created_at ORDER BY created_at ASC) AS created_dates,
      count(*)::int AS cnt
    FROM candidate_tasks
    WHERE cleaned IS NOT NULL AND length(trim(cleaned)) > 0
    GROUP BY cleaned
    HAVING count(*) > 1
  )
  SELECT cleaned, task_ids, titles, task_numbers, created_dates, cnt
  FROM grouped
  ORDER BY cnt DESC, cleaned ASC;
END;
$$;

-- Fusion : supprime les tâches passées en paramètre (et leurs liens Planner)
CREATE OR REPLACE FUNCTION public.merge_planner_title_duplicates(p_task_ids_to_delete uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_deleted int := 0;
  v_links_deleted int := 0;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_task_ids_to_delete IS NULL OR array_length(p_task_ids_to_delete, 1) IS NULL THEN
    RETURN jsonb_build_object('deleted_tasks', 0, 'deleted_links', 0);
  END IF;

  -- Suppression des liens Planner associés
  WITH del_links AS (
    DELETE FROM public.planner_task_links
    WHERE local_task_id = ANY(p_task_ids_to_delete)
    RETURNING id
  )
  SELECT count(*) INTO v_links_deleted FROM del_links;

  -- Suppression des tâches : seulement celles dont l'utilisateur est propriétaire
  -- (ou si admin)
  WITH del_tasks AS (
    DELETE FROM public.tasks t
    WHERE t.id = ANY(p_task_ids_to_delete)
      AND (
        t.user_id = v_user
        OR public.has_role(v_user, 'admin'::public.app_role)
      )
    RETURNING t.id
  )
  SELECT count(*) INTO v_deleted FROM del_tasks;

  RETURN jsonb_build_object(
    'deleted_tasks', v_deleted,
    'deleted_links', v_links_deleted
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.clean_planner_task_title(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_planner_title_duplicates(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_planner_title_duplicates(uuid[]) TO authenticated;