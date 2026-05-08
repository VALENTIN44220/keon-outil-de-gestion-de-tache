-- ============================================================
-- MODULES 006 — Setup IT/Digital
-- ============================================================
-- Reset des anciennes demandes IT (par convention de l utilisateur :
-- garder budgets/carto/projets IT, supprimer uniquement les demandes
-- de support).
--
-- Auto-affectation : a la creation d une task IT, on lit
-- process_template.settings.default_assignee_profile_id (configurable
-- par prestation) et on assigne automatiquement.
--
-- Champs stockes dans module_data :
--   - prestation (nom de la prestation choisie)
--   - nom_dossier_sharepoint, emails_acces (pour SharePoint)
--   - num_ticket_itp (pour Divalto), num_ticket_blc (pour Pipedrive)
--   - champ_complementaire_cible (rempli par cible)
-- ============================================================

-- ========== RESET DES ANCIENNES DEMANDES IT ==========
-- Identifiees par les nouveaux process_template_ids IT (301-307) ou
-- par module_code='it'. On NE TOUCHE PAS aux it_projects, it_budget*,
-- it_solutions* (= budget, carto, projets a conserver).

DELETE FROM public.task_status_transitions
WHERE task_id IN (
  SELECT id FROM public.tasks
  WHERE module_code = 'it'
     OR source_process_template_id IN (
       '11111111-1111-4111-8111-111111111301',
       '11111111-1111-4111-8111-111111111302',
       '11111111-1111-4111-8111-111111111303',
       '11111111-1111-4111-8111-111111111304',
       '11111111-1111-4111-8111-111111111305',
       '11111111-1111-4111-8111-111111111306',
       '11111111-1111-4111-8111-111111111307'
     )
);

DELETE FROM public.task_comments
WHERE task_id IN (
  SELECT id FROM public.tasks WHERE module_code = 'it'
);

DELETE FROM public.workload_slots
WHERE task_id IN (
  SELECT id FROM public.tasks WHERE module_code = 'it'
);

DELETE FROM public.tasks WHERE module_code = 'it';

-- ========== INDEX ==========
CREATE INDEX IF NOT EXISTS idx_tasks_module_it
  ON public.tasks (created_at DESC)
  WHERE module_code = 'it';

-- ========== TRIGGER AUTO-AFFECTATION + NOTIF ==========
-- A la creation : auto-assigne et notifie la cible.
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
  v_prestation text;
BEGIN
  IF NEW.type IS DISTINCT FROM 'request' THEN RETURN NEW; END IF;
  IF NEW.module_code IS DISTINCT FROM 'it'::public.module_code THEN RETURN NEW; END IF;

  -- Si une cible est definie dans le process_template, auto-affecter
  IF NEW.source_process_template_id IS NOT NULL THEN
    SELECT settings INTO v_settings
    FROM public.process_templates
    WHERE id = NEW.source_process_template_id;

    IF v_settings IS NOT NULL AND v_settings ? 'default_assignee_profile_id' THEN
      v_assignee_profile_id := (v_settings->>'default_assignee_profile_id')::uuid;
    END IF;
  END IF;

  -- Met a jour la task avec assignee_id et status='affectee' (via mappage status existant)
  IF v_assignee_profile_id IS NOT NULL THEN
    UPDATE public.tasks
    SET assignee_id = v_assignee_profile_id
    WHERE id = NEW.id AND assignee_id IS NULL;

    -- Notifie la cible
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
        'it_request',
        'task',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_handle_it_request ON public.tasks;
CREATE TRIGGER trg_handle_it_request
AFTER INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.handle_it_request_submission();
