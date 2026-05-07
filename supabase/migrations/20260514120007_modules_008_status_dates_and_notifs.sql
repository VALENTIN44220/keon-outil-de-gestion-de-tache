-- ============================================================
-- MODULES 008 — Tracking dates de statut + notifs changement etat
-- ============================================================
-- Ajoute :
-- 1. tasks.status_dates JSONB : historique compact { statut: timestamp ISO }
--    (similaire a be_status_dates). Permet de connaitre la date d entree
--    dans chaque etat (incluant date d ouverture, date de cloture).
-- 2. Trigger AFTER UPDATE qui :
--    - met a jour status_dates quand status change
--    - notifie le demandeur a chaque changement d etat (modules IT,
--      logistique, maintenance, comm, innovation - pas BE qui a deja
--      sa propre logique)
-- ============================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS status_dates JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.tasks.status_dates IS
  'Historique des transitions de status sous forme {statut: timestamp ISO}. Permet date_ouverture/cloture/etat.';

-- Backfill : pour les tasks existantes on met le status courant a created_at
UPDATE public.tasks
SET status_dates = jsonb_build_object(status, to_jsonb(created_at))
WHERE status_dates IS NULL OR status_dates = '{}'::jsonb;

-- ============================================================
-- Fonction trigger : track + notif sur changement de status
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_task_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_requester_user_id uuid;
  v_assignee_user_id uuid;
  v_assignee_name text;
  v_status_label text;
  v_now timestamptz := now();
BEGIN
  -- Bypass si status n a pas change
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  -- 1. Met a jour status_dates avec la date du nouveau statut
  NEW.status_dates := COALESCE(OLD.status_dates, '{}'::jsonb)
                      || jsonb_build_object(NEW.status, to_jsonb(v_now));

  -- 2. Notifie le demandeur (sauf BE qui a sa propre logique)
  IF NEW.module_code IN ('it', 'logistique', 'maintenance', 'comm', 'innovation', 'rh') THEN
    -- Resoud les user_ids
    IF NEW.requester_id IS NOT NULL THEN
      SELECT user_id INTO v_requester_user_id
      FROM public.profiles WHERE id = NEW.requester_id;
    END IF;

    IF NEW.assignee_id IS NOT NULL THEN
      SELECT user_id, COALESCE(display_name, 'L assigne')
      INTO v_assignee_user_id, v_assignee_name
      FROM public.profiles WHERE id = NEW.assignee_id;
    END IF;

    -- Label lisible
    v_status_label := CASE NEW.status
      WHEN 'todo' THEN 'À traiter'
      WHEN 'in-progress' THEN 'En cours'
      WHEN 'in_progress' THEN 'En cours'
      WHEN 'en_attente_complement_demandeur' THEN 'Attente compléments demandeur'
      WHEN 'en_attente_retour_externe' THEN 'Attente retour externe'
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

    -- Notif au demandeur (s il n est pas l auteur du changement, mais
    -- on n a pas auth.uid ici de maniere fiable, donc on notifie
    -- toujours le demandeur sauf si c est lui qui est aussi l assigne)
    IF v_requester_user_id IS NOT NULL
       AND v_requester_user_id IS DISTINCT FROM v_assignee_user_id THEN
      INSERT INTO public.notifications (user_id, title, message, type, related_entity_type, related_entity_id)
      VALUES (
        v_requester_user_id,
        'Demande mise à jour : ' || v_status_label,
        COALESCE(v_assignee_name, 'L assigne') ||
          ' a mis à jour votre demande « ' || COALESCE(NEW.title, 'sans titre') ||
          ' » au statut : ' || v_status_label,
        'request_status_change',
        'task',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_handle_task_status_change ON public.tasks;
CREATE TRIGGER trg_handle_task_status_change
BEFORE UPDATE OF status ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.handle_task_status_change();

COMMENT ON FUNCTION public.handle_task_status_change() IS
  'Met a jour tasks.status_dates a chaque changement et notifie le demandeur (modules IT/log/maint/comm/inno/rh).';
