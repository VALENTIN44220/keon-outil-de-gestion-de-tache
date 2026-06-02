-- =====================================================================
-- IT_REQUESTS_UNIFY 001 — Aligner les demandes IT sur le flux BE
-- =====================================================================
-- Pattern repris de be_002 (extend_tasks_be) + be_008 (status_dates) :
-- on greffe les colonnes IT sur `tasks`, toutes nullable, additif.
--
-- Machine d'état IT (alignée BE mais valeurs distinctes pour isolation) :
--
--   affectee  ─→  en_cours  ─→  a_relire  ─→  a_valider  ─→  cloturee
--                    ↑   ↓         ↓
--                    │   │         └─→ complement_demande ─→ (re)en_cours
--                    │   │
--                    │   └─→ en_attente_externe / en_attente_ticket_itp
--                    │       en_attente_ticket_blc / en_attente_chiffrage
--                    │
--                    └─────────────────────────┘
--                          (retour de l'attente)
--
--   refusee = état terminal négatif (depuis a_relire, a_valider ou en_cours)
--
-- N1 = équipe IT (peer review — n'importe quel membre IT_TEAM sauf assignee)
-- N2 = demandeur (validation_level_2_type='requester')
--
-- Affectation initiale conservée : trigger handle_it_request_submission
-- lit process_templates.settings.default_assignee_profile_id et pose
-- it_request_status='affectee' + assignee_id.
-- =====================================================================

-- ========== COLONNES ==========
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS it_request_status TEXT
    CHECK (it_request_status IN (
      'affectee',
      'en_cours',
      'a_relire',
      'a_valider',
      'cloturee',
      'refusee',
      'complement_demande',
      'en_attente_externe',
      'en_attente_ticket_itp',
      'en_attente_ticket_blc',
      'en_attente_chiffrage'
    ));

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS it_status_dates JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS it_urgency TEXT
    CHECK (it_urgency IN ('normal', 'urgent', 'critique'));

-- ========== BACKFILL ==========
-- Mappage status standard → it_request_status pour les demandes IT existantes.
UPDATE public.tasks
SET it_request_status = CASE
  WHEN status = 'en_attente_complement_demandeur'   THEN 'complement_demande'
  WHEN status = 'en_attente_retour_externe'         THEN 'en_attente_externe'
  WHEN status = 'en_attente_retour_ticket_itp'      THEN 'en_attente_ticket_itp'
  WHEN status = 'en_attente_retour_ticket_blc'      THEN 'en_attente_ticket_blc'
  WHEN status = 'en_attente_chiffrage'              THEN 'en_attente_chiffrage'
  WHEN status IN ('in-progress', 'in_progress')     THEN 'en_cours'
  WHEN status IN ('realisee', 'done')               THEN 'cloturee'
  WHEN status = 'cancelled'                          THEN 'refusee'
  ELSE 'affectee'  -- todo, affectee, ou tout autre → affectee (assignee_id existe via trigger)
END
WHERE module_code = 'it'
  AND type = 'request'
  AND it_request_status IS NULL;

-- Backfill it_status_dates : initialiser avec le statut courant à created_at
UPDATE public.tasks
SET it_status_dates = jsonb_build_object(it_request_status, to_jsonb(created_at))
WHERE module_code = 'it'
  AND type = 'request'
  AND it_request_status IS NOT NULL
  AND (it_status_dates IS NULL OR it_status_dates = '{}'::jsonb);

-- Backfill it_urgency : par défaut 'normal'
UPDATE public.tasks
SET it_urgency = 'normal'
WHERE module_code = 'it'
  AND type = 'request'
  AND it_urgency IS NULL;

-- ========== INDEX ==========
CREATE INDEX IF NOT EXISTS idx_tasks_it_request_status
  ON public.tasks (it_request_status, module_code)
  WHERE it_request_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_it_urgency
  ON public.tasks (it_urgency)
  WHERE it_urgency IS NOT NULL;

-- ========== TRIGGER AUTO-AFFECTATION : étendre pour poser it_request_status ==========
-- On conserve la logique d'auto-affectation existante (lecture de
-- process_templates.settings.default_assignee_profile_id) et on ajoute
-- l'initialisation de it_request_status='affectee' + it_status_dates +
-- it_urgency='normal'.
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

  -- Résolution cible auto-affectation depuis process_templates.settings
  IF NEW.source_process_template_id IS NOT NULL THEN
    SELECT settings INTO v_settings
    FROM public.process_templates
    WHERE id = NEW.source_process_template_id;

    IF v_settings IS NOT NULL AND v_settings ? 'default_assignee_profile_id' THEN
      v_assignee_profile_id := (v_settings->>'default_assignee_profile_id')::uuid;
    END IF;
  END IF;

  IF v_assignee_profile_id IS NOT NULL THEN
    -- Auto-affectation : assignee + statut initial 'affectee'
    UPDATE public.tasks
    SET assignee_id        = v_assignee_profile_id,
        it_request_status  = COALESCE(it_request_status, 'affectee'),
        it_status_dates    = COALESCE(it_status_dates, '{}'::jsonb)
                             || jsonb_build_object('affectee', to_jsonb(now())),
        it_urgency         = COALESCE(it_urgency, 'normal')
    WHERE id = NEW.id AND assignee_id IS NULL;

    -- Notif cible
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
  ELSE
    -- Pas de cible par défaut : on initialise quand même le statut pour cohérence
    UPDATE public.tasks
    SET it_request_status = COALESCE(it_request_status, 'affectee'),
        it_status_dates   = COALESCE(it_status_dates, '{}'::jsonb)
                            || jsonb_build_object('affectee', to_jsonb(now())),
        it_urgency        = COALESCE(it_urgency, 'normal')
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$func$;

-- =====================================================================
-- Note : le trigger handle_task_status_change (sur `status` standard)
-- continue de gérer les notifs sur la colonne `status`. La nouvelle
-- machine IT vivra sur it_request_status, donc le hook useITRequestStatus
-- (Phase C) émettra les notifs côté frontend, comme le fait useBETaskStatus.
-- =====================================================================
