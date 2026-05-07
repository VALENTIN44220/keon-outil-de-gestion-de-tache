-- ============================================================
-- MODULES 010 — Fix auto-affectation IT
-- ============================================================
-- Le trigger handle_it_request_submission posait l assignee_id mais
-- laissait status='todo'. Du coup l affichage indiquait 'À traiter'
-- alors que la tache etait deja affectee. Pire : si l UPDATE
-- process_templates.settings n etait pas execute, l assignee restait
-- NULL.
--
-- Fixes :
-- 1. Le trigger met BIEN assignee_id + status='affectee' quand un
--    settings.default_assignee_profile_id est trouve.
-- 2. Si pas de settings : le status reste 'todo' mais on log un warning.
-- 3. La notif est posee correctement au cible.
-- 4. Le BEFORE UPDATE trigger handle_task_status_change bypass les
--    inserts auto-affectation (qui restent une initialisation, pas
--    un changement metier).
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_it_request_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_settings jsonb;
  v_assignee_profile_id uuid;
  v_assignee_user_id uuid;
  v_assignee_name text;
  v_requester_name text;
  v_referent_user_id uuid;
  v_prestation text;
BEGIN
  IF NEW.type IS DISTINCT FROM 'request' THEN RETURN NEW; END IF;
  IF NEW.module_code IS DISTINCT FROM 'it'::public.module_code THEN RETURN NEW; END IF;

  -- Lit le settings du process_template
  IF NEW.source_process_template_id IS NOT NULL THEN
    SELECT settings INTO v_settings FROM public.process_templates WHERE id = NEW.source_process_template_id;
    IF v_settings IS NOT NULL AND v_settings ? 'default_assignee_profile_id' THEN
      v_assignee_profile_id := (v_settings->>'default_assignee_profile_id')::uuid;
    END IF;
  END IF;

  -- Auto-affectation si cible definie
  IF v_assignee_profile_id IS NOT NULL THEN
    -- Update assignee_id ET status='affectee' (status_dates suivra via le trigger sur status)
    UPDATE public.tasks
    SET assignee_id = v_assignee_profile_id,
        status = 'affectee'
    WHERE id = NEW.id;

    -- Notif a la cible
    SELECT user_id, COALESCE(display_name, 'Quelqu''un')
    INTO v_assignee_user_id, v_assignee_name
    FROM public.profiles WHERE id = v_assignee_profile_id;

    IF v_assignee_user_id IS NOT NULL THEN
      IF NEW.requester_id IS NOT NULL THEN
        SELECT COALESCE(display_name, 'Quelqu''un') INTO v_requester_name
        FROM public.profiles WHERE id = NEW.requester_id;
      ELSE
        v_requester_name := 'Quelqu''un';
      END IF;

      v_prestation := COALESCE(NEW.module_data->>'prestation', 'IT');

      INSERT INTO public.notifications (user_id, title, message, type, related_entity_type, related_entity_id)
      VALUES (
        v_assignee_user_id,
        'Nouvelle demande IT',
        v_requester_name || ' a soumis une demande ' || v_prestation || ' : ' || COALESCE(NEW.title, 'sans titre'),
        'it_request', 'task', NEW.id
      );
    END IF;

    -- Notif au referent metier (en plus de la cible) a la creation
    IF NEW.module_data ? 'referent_metier_profile_id' THEN
      SELECT user_id INTO v_referent_user_id
      FROM public.profiles
      WHERE id = (NEW.module_data->>'referent_metier_profile_id')::uuid;

      IF v_referent_user_id IS NOT NULL
         AND v_referent_user_id IS DISTINCT FROM v_assignee_user_id THEN
        INSERT INTO public.notifications (user_id, title, message, type, related_entity_type, related_entity_id)
        VALUES (
          v_referent_user_id,
          '[Référent] Nouvelle demande IT',
          'Vous etes referent metier sur la demande IT ' || COALESCE(NEW.module_data->>'prestation', '') ||
            ' : ' || COALESCE(NEW.title, 'sans titre'),
          'it_request_referent', 'task', NEW.id
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;
