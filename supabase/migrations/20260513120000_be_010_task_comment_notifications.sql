-- ============================================================
-- BE 010 — Notifications sur commentaires de tâche
-- ============================================================
-- Quand un user ajoute un commentaire sur une tâche, on génère des
-- notifications dans la table public.notifications pour :
--   • l'assigné (s'il n'est pas l'auteur)
--   • le manager de l'assigné (N+1) (s'il n'est pas l'auteur)
--   • le demandeur (requester) (s'il n'est pas l'auteur)
--
-- La table notifications RLS n'autorise que SELECT/UPDATE par user_id =
-- auth.uid(). Les INSERTs passent en SECURITY DEFINER pour bypasser RLS.
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_task_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_task RECORD;
  v_author_user_id uuid;
  v_author_name text;
  v_assignee_user_id uuid;
  v_assignee_manager_profile_id uuid;
  v_assignee_manager_user_id uuid;
  v_requester_user_id uuid;
  v_title text;
  v_msg text;
  v_recipients uuid[];
BEGIN
  -- Récupère la tâche cible
  SELECT id, title, assignee_id, requester_id
  INTO v_task
  FROM public.tasks
  WHERE id = NEW.task_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Auth user_id de l'auteur du commentaire
  SELECT user_id, COALESCE(display_name, 'Quelqu''un')
  INTO v_author_user_id, v_author_name
  FROM public.profiles
  WHERE id = NEW.author_id;

  -- Auth user_id de l'assigné
  IF v_task.assignee_id IS NOT NULL THEN
    SELECT user_id, manager_id INTO v_assignee_user_id, v_assignee_manager_profile_id
    FROM public.profiles WHERE id = v_task.assignee_id;
  END IF;

  -- Auth user_id du manager de l'assigné
  IF v_assignee_manager_profile_id IS NOT NULL THEN
    SELECT user_id INTO v_assignee_manager_user_id
    FROM public.profiles WHERE id = v_assignee_manager_profile_id;
  END IF;

  -- Auth user_id du demandeur
  IF v_task.requester_id IS NOT NULL THEN
    SELECT user_id INTO v_requester_user_id
    FROM public.profiles WHERE id = v_task.requester_id;
  END IF;

  v_title := 'Nouveau commentaire';
  v_msg := v_author_name || ' a commenté « ' || COALESCE(v_task.title, 'Tâche') || ' »';

  -- Construit la liste de destinataires (sans l'auteur, sans doublons)
  v_recipients := ARRAY[]::uuid[];
  IF v_assignee_user_id IS NOT NULL AND v_assignee_user_id <> v_author_user_id THEN
    v_recipients := array_append(v_recipients, v_assignee_user_id);
  END IF;
  IF v_assignee_manager_user_id IS NOT NULL
     AND v_assignee_manager_user_id <> v_author_user_id
     AND NOT (v_assignee_manager_user_id = ANY(v_recipients)) THEN
    v_recipients := array_append(v_recipients, v_assignee_manager_user_id);
  END IF;
  IF v_requester_user_id IS NOT NULL
     AND v_requester_user_id <> v_author_user_id
     AND NOT (v_requester_user_id = ANY(v_recipients)) THEN
    v_recipients := array_append(v_recipients, v_requester_user_id);
  END IF;

  -- Insert une notif par destinataire
  IF array_length(v_recipients, 1) > 0 THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_entity_type, related_entity_id)
    SELECT
      uid,
      v_title,
      v_msg,
      'task_comment',
      'task',
      v_task.id
    FROM unnest(v_recipients) AS uid;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_task_comment ON public.task_comments;
CREATE TRIGGER trg_notify_task_comment
AFTER INSERT ON public.task_comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_comment();

COMMENT ON FUNCTION public.notify_task_comment() IS
  'Crée des notifications dans public.notifications à chaque commentaire de tâche, pour assigné + manager (N+1) + demandeur (sauf l''auteur).';
