-- ════════════════════════════════════════════════════════════════════════
-- Logistique : workflow devis (quotation) propre
--   - rollback du seed task_templates auto-spawn pour IT/Maintenance/Logistique
--     (flux mono-étape avec leur propre enum de statut)
--   - extension tasks_status_check : devis_a_chiffrer + devis_a_valider
--   - extension handle_task_status_change : libellés notifs devis
-- ════════════════════════════════════════════════════════════════════════

-- 1) Rollback : supprime les task_templates "Réalisation" seedés pour IT/Maintenance/Logistique
DELETE FROM task_templates
WHERE process_template_id IN (
  '11111111-1111-4111-8111-111111111301','11111111-1111-4111-8111-111111111302',
  '11111111-1111-4111-8111-111111111303','11111111-1111-4111-8111-111111111304',
  '11111111-1111-4111-8111-111111111305','11111111-1111-4111-8111-111111111306',
  '11111111-1111-4111-8111-111111111307','11111111-1111-4111-8111-111111111308',
  '11111111-1111-4111-8111-111111111309','11111111-1111-4111-8111-111111111310',
  '11111111-1111-4111-8111-111111111101','11111111-1111-4111-8111-111111111201'
) AND title = 'Réalisation';

-- 2) Extension du CHECK constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status = ANY (ARRAY[
  'todo','in-progress','in_progress','done','to_assign',
  'pending-validation','pending_validation_1','pending_validation_2',
  'validated','refused','review','cancelled',
  'soumise','affectee','en_cours','a_relire','a_valider','a_deposer','en_instruction',
  'complement_demande','cloturee',
  'en_attente_complement_demandeur','en_attente_retour_externe','realisee',
  'en_attente_retour_ticket_itp','en_attente_retour_ticket_blc','en_attente_chiffrage',
  'planifiee','en_enlevement','en_livraison','livree','abandonnee',
  'preparation_codir','arbitrage_codir','mise_en_oeuvre','refusee_codir','standby',
  'devis_a_chiffrer','devis_a_valider'
]));

-- 3) Extension notifications (libellés)
CREATE OR REPLACE FUNCTION public.handle_task_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_requester_user_id uuid; v_assignee_user_id uuid; v_referent_user_id uuid;
  v_assignee_name text; v_status_label text; v_now timestamptz := now();
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  NEW.status_dates := COALESCE(OLD.status_dates, '{}'::jsonb)
                      || jsonb_build_object(NEW.status, to_jsonb(v_now));
  IF NEW.module_code IN ('it', 'logistique', 'maintenance', 'comm', 'innovation', 'rh') THEN
    IF NEW.requester_id IS NOT NULL THEN
      SELECT user_id INTO v_requester_user_id FROM public.profiles WHERE id = NEW.requester_id;
    END IF;
    IF NEW.assignee_id IS NOT NULL THEN
      SELECT user_id, COALESCE(display_name, 'L assigne') INTO v_assignee_user_id, v_assignee_name
      FROM public.profiles WHERE id = NEW.assignee_id;
    END IF;
    IF NEW.module_data ? 'referent_metier_profile_id' THEN
      SELECT user_id INTO v_referent_user_id
      FROM public.profiles WHERE id = (NEW.module_data->>'referent_metier_profile_id')::uuid;
    END IF;
    v_status_label := CASE NEW.status
      WHEN 'todo' THEN 'À traiter'
      WHEN 'devis_a_chiffrer' THEN 'Devis à chiffrer'
      WHEN 'devis_a_valider' THEN '💬 Devis proposé — à valider'
      WHEN 'in-progress' THEN 'En cours' WHEN 'in_progress' THEN 'En cours'
      WHEN 'affectee' THEN 'Affectée'
      WHEN 'en_attente_complement_demandeur' THEN 'Attente compléments demandeur'
      WHEN 'en_attente_retour_externe' THEN 'Attente retour externe'
      WHEN 'en_attente_retour_ticket_itp' THEN 'Attente retour ticket ITP (Divalto)'
      WHEN 'en_attente_retour_ticket_blc' THEN 'Attente retour ticket BLC (Pipedrive)'
      WHEN 'en_attente_chiffrage' THEN 'Attente de chiffrage'
      WHEN 'realisee' THEN 'Réalisée' WHEN 'cloturee' THEN 'Clôturée'
      WHEN 'planifiee' THEN 'Planifiée' WHEN 'en_enlevement' THEN 'En enlèvement'
      WHEN 'en_livraison' THEN 'En livraison' WHEN 'livree' THEN 'Livrée'
      WHEN 'done' THEN 'Terminée'
      WHEN 'abandonnee' THEN 'Annulée' WHEN 'cancelled' THEN 'Annulée'
      ELSE NEW.status END;
    IF v_requester_user_id IS NOT NULL AND v_requester_user_id IS DISTINCT FROM v_assignee_user_id THEN
      INSERT INTO public.notifications (user_id, title, message, type, related_entity_type, related_entity_id)
      VALUES (v_requester_user_id, 'Demande mise à jour : ' || v_status_label,
        COALESCE(v_assignee_name, 'L assigne') || ' a mis à jour votre demande « ' ||
          COALESCE(NEW.title, 'sans titre') || ' » au statut : ' || v_status_label,
        'request_status_change', 'task', NEW.id);
    END IF;
    IF v_referent_user_id IS NOT NULL
       AND v_referent_user_id IS DISTINCT FROM v_assignee_user_id
       AND v_referent_user_id IS DISTINCT FROM v_requester_user_id THEN
      INSERT INTO public.notifications (user_id, title, message, type, related_entity_type, related_entity_id)
      VALUES (v_referent_user_id, '[Référent] Demande mise à jour : ' || v_status_label,
        'En tant que référent métier sur « ' || COALESCE(NEW.title, 'sans titre') ||
          ' », statut : ' || v_status_label,
        'request_status_change_referent', 'task', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
