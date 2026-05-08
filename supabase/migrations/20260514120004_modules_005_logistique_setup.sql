-- ============================================================
-- MODULES 005 — Setup Logistique
-- ============================================================
-- Module Logistique = redémarrage propre (pas d historique a migrer).
-- Pas de table dediee : tout dans tasks + module_data jsonb pour les
-- champs specifiques (filiale, urgence, adresses, nb colis, etc.).
--
-- Champs stockes dans module_data :
--   - filiale (text)
--   - code_projet (text)
--   - quotation (text)
--   - urgence (bool)
--   - nature_marchandise (text)
--   - depart_stock_bgn (bool)
--   - expediteur_adresse, expediteur_nom, expediteur_tel (textes)
--   - destinataire_adresse, destinataire_nom, destinataire_tel (textes)
--   - nb_colis (number)
--   - type_colis (text)
--   - date_souhaitee_enlevement (date iso)
--   - date_prise_en_charge (date iso) [renseigne par cible]
--   - transporteur (text) [renseigne par cible]
--   - num_suivi (text)
--   - date_livraison_prevue (date iso)
--   - date_livraison_effective (date iso)
--   - cout (number, optionnel)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_tasks_module_logistique
  ON public.tasks (created_at DESC)
  WHERE module_code = 'logistique';

-- ========== TRIGGER NOTIF COORDINATEURS ==========
-- A la creation d une demande logistique : notifier les coordinateurs
-- definis dans process_template.settings.coordinator_profile_ids
-- (array d UUIDs). Fallback : aucun (a configurer apres).
--
-- Si urgence=true : priorite 'urgent' dans le message.
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_logistique_request_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_coordinator_user_ids uuid[];
  v_coordinator_profile_ids uuid[];
  v_requester_name text;
  v_settings jsonb;
  v_is_urgent boolean;
  v_filiale text;
  v_msg text;
  v_title text;
BEGIN
  IF NEW.type IS DISTINCT FROM 'request' THEN RETURN NEW; END IF;
  IF NEW.module_code IS DISTINCT FROM 'logistique'::public.module_code THEN RETURN NEW; END IF;

  -- Extrait les coordinateurs depuis process_template.settings
  IF NEW.source_process_template_id IS NOT NULL THEN
    SELECT settings INTO v_settings
    FROM public.process_templates
    WHERE id = NEW.source_process_template_id;

    IF v_settings IS NOT NULL AND v_settings ? 'coordinator_profile_ids' THEN
      v_coordinator_profile_ids := ARRAY(
        SELECT (jsonb_array_elements_text(v_settings->'coordinator_profile_ids'))::uuid
      );
    END IF;
  END IF;

  -- Fallback : tous les admins
  IF v_coordinator_profile_ids IS NULL OR array_length(v_coordinator_profile_ids, 1) IS NULL THEN
    SELECT array_agg(p.id) INTO v_coordinator_profile_ids
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id
    WHERE ur.role = 'admin'::public.app_role;
  END IF;

  IF v_coordinator_profile_ids IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resoud les auth user_ids
  SELECT array_agg(p.user_id) INTO v_coordinator_user_ids
  FROM public.profiles p
  WHERE p.id = ANY(v_coordinator_profile_ids) AND p.user_id IS NOT NULL;

  IF v_coordinator_user_ids IS NULL THEN RETURN NEW; END IF;

  -- Nom du demandeur
  IF NEW.requester_id IS NOT NULL THEN
    SELECT COALESCE(display_name, 'Quelqu''un') INTO v_requester_name
    FROM public.profiles WHERE id = NEW.requester_id;
  ELSE
    v_requester_name := 'Quelqu''un';
  END IF;

  v_is_urgent := COALESCE((NEW.module_data->>'urgence')::boolean, false);
  v_filiale := COALESCE(NEW.module_data->>'filiale', '');

  IF v_is_urgent THEN
    v_title := 'TRANSPORT URGENT — ' || v_filiale;
    v_msg := v_requester_name || ' a soumis une demande de transport URGENT' ||
             CASE WHEN v_filiale <> '' THEN ' (' || v_filiale || ')' ELSE '' END ||
             ' : ' || COALESCE(NEW.module_data->>'nature_marchandise', NEW.title, 'sans titre');
  ELSE
    v_title := 'Nouvelle demande de transport';
    v_msg := v_requester_name || ' a soumis une demande de transport' ||
             CASE WHEN v_filiale <> '' THEN ' (' || v_filiale || ')' ELSE '' END ||
             ' : ' || COALESCE(NEW.module_data->>'nature_marchandise', NEW.title, 'sans titre');
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, related_entity_type, related_entity_id)
  SELECT uid, v_title, v_msg, 'logistique_request', 'task', NEW.id
  FROM unnest(v_coordinator_user_ids) AS uid;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_logistique_request ON public.tasks;
CREATE TRIGGER trg_notify_logistique_request
AFTER INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_logistique_request_submission();

COMMENT ON FUNCTION public.notify_logistique_request_submission() IS
  'A la creation d une demande logistique, notifie les coordinateurs definis dans process_template.settings.coordinator_profile_ids (fallback : tous les admins).';
