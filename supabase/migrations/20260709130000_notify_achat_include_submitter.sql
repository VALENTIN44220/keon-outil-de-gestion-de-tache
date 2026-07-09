-- Notification « nouvelle demande fournisseur » au Service Achat.
--
-- Correctif : jusqu'ici le demandeur était EXCLU de la notification
-- (p.user_id IS DISTINCT FROM NEW.submitted_by_user_id). Or, dans l'org KEON,
-- un membre du Service Achat peut lui-même saisir une demande fournisseur.
-- Dans ce cas il ne recevait aucune notification « à valider » — ce qui donne
-- l'impression que le flux ne notifie rien lorsqu'un acheteur teste lui-même.
--
-- On notifie désormais TOUS les membres du groupe Service Achat, y compris le
-- demandeur s'il en fait partie. Pour un demandeur hors du groupe, aucun
-- changement (il n'est de toute façon pas sélectionné par l'appartenance au groupe).

CREATE OR REPLACE FUNCTION public.notify_achat_on_new_supplier_demand()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_notif_uid     uuid;
  v_submitter_name text;
BEGIN
  SELECT coalesce(display_name, 'Un collaborateur')
    INTO v_submitter_name
  FROM public.profiles
  WHERE user_id = NEW.submitted_by_user_id;

  -- Notifier les membres du groupe « Service Achat » (y compris le demandeur
  -- s'il en est membre : il reste un valideur potentiel de la demande).
  FOR v_notif_uid IN
    SELECT p.user_id
    FROM public.collaborator_group_members cgm
    JOIN public.profiles p ON p.id = cgm.user_id
    WHERE cgm.group_id = 'a1111111-1111-1111-1111-111111111111'
      AND p.user_id IS NOT NULL
  LOOP
    INSERT INTO public.notifications (
      user_id, title, message, type,
      related_entity_type, related_entity_id
    ) VALUES (
      v_notif_uid,
      'Nouvelle demande de fournisseur',
      format(
        '%s a soumis une demande de création pour le fournisseur « %s » (%s). Votre validation est requise.',
        coalesce(v_submitter_name, 'Un collaborateur'),
        coalesce(NEW.nomfournisseur, 'inconnu'),
        coalesce(NEW.entite, '—')
      ),
      'supplier_new_demand',
      'supplier_waiting_approval',
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$function$;
