-- ============================================================
-- MODULES 009 — Statuts specifiques IT (Divalto, Pipedrive)
-- ============================================================
-- Ajoute aux statuts existants :
--   - en_attente_retour_ticket_itp (Divalto)
--   - en_attente_retour_ticket_blc (Pipedrive)
--   - en_attente_chiffrage (Divalto + Pipedrive)
--
-- L UI propose ces boutons uniquement quand la prestation correspondante
-- est selectionnee.
-- ============================================================

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check
CHECK (status = ANY (ARRAY[
  -- Standard
  'todo'::text, 'in-progress'::text, 'in_progress'::text, 'done'::text,
  'to_assign'::text, 'pending-validation'::text, 'pending_validation_1'::text,
  'pending_validation_2'::text, 'validated'::text, 'refused'::text,
  'review'::text, 'cancelled'::text,
  -- BE
  'soumise'::text, 'affectee'::text, 'en_cours'::text, 'a_relire'::text,
  'a_valider'::text, 'a_deposer'::text, 'en_instruction'::text,
  'complement_demande'::text, 'cloturee'::text,
  -- IT
  'en_attente_complement_demandeur'::text, 'en_attente_retour_externe'::text,
  'realisee'::text,
  -- IT specifiques (Divalto / Pipedrive)
  'en_attente_retour_ticket_itp'::text,
  'en_attente_retour_ticket_blc'::text,
  'en_attente_chiffrage'::text,
  -- Logistique
  'planifiee'::text, 'en_enlevement'::text, 'en_livraison'::text,
  'livree'::text, 'abandonnee'::text,
  -- Innovation
  'preparation_codir'::text, 'arbitrage_codir'::text, 'mise_en_oeuvre'::text,
  'refusee_codir'::text, 'standby'::text
]));

-- Met a jour la fonction handle_task_status_change pour les nouveaux labels
CREATE OR REPLACE FUNCTION public.handle_task_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_requester_user_id uuid;
  v_assignee_user_id uuid;
  v_referent_user_id uuid;
  v_assignee_name text;
  v_status_label text;
  v_now timestamptz := now();
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  NEW.status_dates := COALESCE(OLD.status_dates, '{}'::jsonb)
                      || jsonb_build_object(NEW.status, to_jsonb(v_now));

  IF NEW.module_code IN ('it', 'logistique', 'maintenance', 'comm', 'innovation', 'rh') THEN
    IF NEW.requester_id IS NOT NULL THEN
      SELECT user_id INTO v_requester_user_id FROM public.profiles WHERE id = NEW.requester_id;
    END IF;
    IF NEW.assignee_id IS NOT NULL THEN
      SELECT user_id, COALESCE(display_name, 'L assigne')
      INTO v_assignee_user_id, v_assignee_name
      FROM public.profiles WHERE id = NEW.assignee_id;
    END IF;

    -- Referent metier (champ optionnel module_data.referent_metier_profile_id)
    IF NEW.module_data ? 'referent_metier_profile_id' THEN
      SELECT user_id INTO v_referent_user_id
      FROM public.profiles
      WHERE id = (NEW.module_data->>'referent_metier_profile_id')::uuid;
    END IF;

    v_status_label := CASE NEW.status
      WHEN 'todo' THEN 'À traiter'
      WHEN 'in-progress' THEN 'En cours'
      WHEN 'in_progress' THEN 'En cours'
      WHEN 'en_attente_complement_demandeur' THEN 'Attente compléments demandeur'
      WHEN 'en_attente_retour_externe' THEN 'Attente retour externe'
      WHEN 'en_attente_retour_ticket_itp' THEN 'Attente retour ticket ITP (Divalto)'
      WHEN 'en_attente_retour_ticket_blc' THEN 'Attente retour ticket BLC (Pipedrive)'
      WHEN 'en_attente_chiffrage' THEN 'Attente de chiffrage'
      WHEN 'realisee' THEN 'Réalisée'
      WHEN 'cloturee' THEN 'Clôturée'
      WHEN 'planifiee' THEN 'Planifiée'
      WHEN 'en_enlevement' THEN 'En enlèvement'
      WHEN 'en_livraison' THEN 'En livraison'
      WHEN 'livree' THEN 'Livrée'
      WHEN 'abandonnee' THEN 'Annulée'
      WHEN 'cancelled' THEN 'Annulée'
      ELSE NEW.status
    END;

    -- Notif demandeur
    IF v_requester_user_id IS NOT NULL
       AND v_requester_user_id IS DISTINCT FROM v_assignee_user_id THEN
      INSERT INTO public.notifications (user_id, title, message, type, related_entity_type, related_entity_id)
      VALUES (
        v_requester_user_id,
        'Demande mise à jour : ' || v_status_label,
        COALESCE(v_assignee_name, 'L assigne') ||
          ' a mis à jour votre demande « ' || COALESCE(NEW.title, 'sans titre') ||
          ' » au statut : ' || v_status_label,
        'request_status_change', 'task', NEW.id
      );
    END IF;

    -- Notif referent metier (si different demandeur et assigne)
    IF v_referent_user_id IS NOT NULL
       AND v_referent_user_id IS DISTINCT FROM v_assignee_user_id
       AND v_referent_user_id IS DISTINCT FROM v_requester_user_id THEN
      INSERT INTO public.notifications (user_id, title, message, type, related_entity_type, related_entity_id)
      VALUES (
        v_referent_user_id,
        '[Référent] Demande mise à jour : ' || v_status_label,
        'En tant que référent métier sur « ' || COALESCE(NEW.title, 'sans titre') ||
          ' », statut : ' || v_status_label,
        'request_status_change_referent', 'task', NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;
