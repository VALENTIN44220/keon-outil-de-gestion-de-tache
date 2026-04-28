-- Supprime la contrainte UNIQUE globale sur planner_task_links.planner_task_id.
--
-- Cette contrainte etait trop stricte : elle empechait un meme planner_task_id
-- d'apparaitre dans plusieurs mappings (ex. memes plan partage entre plusieurs
-- utilisateurs ou plusieurs categories) ET surtout elle faisait echouer toute
-- re-synchronisation avec "duplicate key value violates unique constraint
-- planner_task_links_planner_task_id_key".
--
-- L'unicite metier reelle est la paire (plan_mapping_id, planner_task_id), deja
-- garantie par l'index unique planner_task_links_mapping_planner_task_unique
-- (cf. migration 20260420075153). On conserve aussi UNIQUE(local_task_id).

ALTER TABLE public.planner_task_links
  DROP CONSTRAINT IF EXISTS planner_task_links_planner_task_id_key;
