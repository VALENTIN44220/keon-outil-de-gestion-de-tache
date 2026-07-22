-- BUG-00019 — Poser la date réelle du jalon à la VALIDATION de l'étape BE.
-- Appliquée en prod le 2026-07-22 (testée : clôture d'étape -> jalon date_reelle).
--
-- Les étapes BE avancent via be_status (jamais status) ; le trigger on_complete
-- écoutait status IN (done/validated/closed) → ne se déclenchait jamais.
-- On le rebranche sur be_status = 'cloturee' (étape terminée = événement réalisé)
-- et on capte la date exacte depuis be_status_dates. Le type de jalon vient de
-- sub_process_templates.milestone_type_code (piloté par l'écran de configuration).

CREATE OR REPLACE FUNCTION public.fn_be_task_milestone_on_complete()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE
  v_label TEXT;
  v_type  TEXT;
  v_date  DATE;
  v_existing_id UUID;
BEGIN
  IF NEW.is_milestone IS NOT TRUE THEN RETURN NEW; END IF;
  IF NEW.be_project_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.type <> 'task' THEN RETURN NEW; END IF;

  IF NOT (NEW.be_status = 'cloturee' AND OLD.be_status IS DISTINCT FROM 'cloturee') THEN
    RETURN NEW;
  END IF;

  v_label := COALESCE(NULLIF(TRIM(NEW.milestone_label), ''), NEW.title);
  SELECT milestone_type_code INTO v_type FROM sub_process_templates WHERE id = NEW.sub_process_template_id;
  v_date := COALESCE((NEW.be_status_dates->>'cloturee')::date, CURRENT_DATE);

  SELECT id INTO v_existing_id FROM be_project_milestones
  WHERE source_task_id = NEW.id AND is_auto_delayed = FALSE LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE be_project_milestones
    SET date_reelle = v_date, statut = 'termine', titre = v_label,
        type_code = COALESCE(v_type, type_code), updated_at = NOW()
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO be_project_milestones (
      be_project_id, titre, description, date_prevue, date_reelle,
      statut, source_task_id, is_auto_delayed, type_code
    ) VALUES (
      NEW.be_project_id, v_label, 'Jalon clôturé', v_date, v_date,
      'termine', NEW.id, FALSE, v_type
    );
  END IF;

  IF NEW.auto_milestone_delay_days IS NOT NULL AND NEW.auto_milestone_delay_days > 0 THEN
    IF NOT EXISTS (SELECT 1 FROM be_project_milestones WHERE source_task_id = NEW.id AND is_auto_delayed = TRUE) THEN
      INSERT INTO be_project_milestones (
        be_project_id, titre, description, date_prevue, statut, source_task_id, is_auto_delayed
      ) VALUES (
        NEW.be_project_id,
        COALESCE(NULLIF(TRIM(NEW.auto_milestone_label), ''), v_label || ' — échéance'),
        'Jalon auto-différé (J+' || NEW.auto_milestone_delay_days || ')',
        v_date + (NEW.auto_milestone_delay_days || ' days')::INTERVAL,
        'a_venir', NEW.id, TRUE
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_be_task_milestone_on_complete ON public.tasks;
CREATE TRIGGER trg_be_task_milestone_on_complete
  AFTER UPDATE OF status, be_status ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION fn_be_task_milestone_on_complete();
