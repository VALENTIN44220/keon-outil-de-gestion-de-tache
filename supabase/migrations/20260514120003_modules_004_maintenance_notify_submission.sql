-- ============================================================
-- MODULES 004 — Notifications a la soumission Maintenance
-- ============================================================
-- Trigger AFTER INSERT sur tasks : si une nouvelle demande maintenance
-- est creee (type=request, module_code='maintenance', status non terminal),
-- on notifie le coordinateur Maintenance.
--
-- Le coordinateur est :
--  1. defini dans process_templates.settings.default_maintenance_assignee_id
--     si renseigne
--  2. fallback : Sylvain ANTZ (profile_id bb9c06f6-910b-4d5d-afb0-d31e1d90c77d)
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_maintenance_request_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_coordinator_profile_id uuid;
  v_coordinator_user_id uuid;
  v_requester_name text;
  v_settings jsonb;
BEGIN
  -- Filtre : on ne notifie qu a la creation d une demande maintenance
  IF NEW.type IS DISTINCT FROM 'request' THEN RETURN NEW; END IF;
  IF NEW.module_code IS DISTINCT FROM 'maintenance'::public.module_code THEN RETURN NEW; END IF;

  -- Cherche le coordinateur dans les settings du process_template
  IF NEW.source_process_template_id IS NOT NULL THEN
    SELECT settings INTO v_settings
    FROM public.process_templates
    WHERE id = NEW.source_process_template_id;

    IF v_settings IS NOT NULL AND v_settings ? 'default_maintenance_assignee_id' THEN
      v_coordinator_profile_id := (v_settings->>'default_maintenance_assignee_id')::uuid;
    END IF;
  END IF;

  -- Fallback : Sylvain ANTZ
  IF v_coordinator_profile_id IS NULL THEN
    v_coordinator_profile_id := 'bb9c06f6-910b-4d5d-afb0-d31e1d90c77d'::uuid;
  END IF;

  -- Resoud le auth user_id du coordinateur
  SELECT user_id INTO v_coordinator_user_id
  FROM public.profiles
  WHERE id = v_coordinator_profile_id;

  IF v_coordinator_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Nom du demandeur
  IF NEW.requester_id IS NOT NULL THEN
    SELECT COALESCE(display_name, 'Quelqu''un') INTO v_requester_name
    FROM public.profiles WHERE id = NEW.requester_id;
  ELSE
    v_requester_name := 'Quelqu''un';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, related_entity_type, related_entity_id)
  VALUES (
    v_coordinator_user_id,
    'Nouvelle demande matériel',
    v_requester_name || ' a soumis une demande matériel à valider : ' || COALESCE(NEW.title, 'Demande sans titre'),
    'maintenance_request',
    'task',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_maintenance_request ON public.tasks;
CREATE TRIGGER trg_notify_maintenance_request
AFTER INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_maintenance_request_submission();

COMMENT ON FUNCTION public.notify_maintenance_request_submission() IS
  'A la creation d une demande maintenance (task type=request, module_code=maintenance), notifie le coordinateur (Sylvain ANTZ par defaut).';
