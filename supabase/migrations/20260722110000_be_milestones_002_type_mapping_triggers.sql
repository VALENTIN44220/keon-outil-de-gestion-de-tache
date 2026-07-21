-- BUG-00019 Lot 2 — Mapping sous-étape → type de jalon + auto-génération typée.
-- Les triggers existants créent déjà les jalons (date réelle à la complétion) ;
-- ils ne posaient pas type_code → les jalons auto n'apparaissaient pas dans la
-- synthèse pivotée. On ajoute le mapping et on l'injecte dans les triggers.

-- 1) Colonne de mapping sur les sous-étapes.
ALTER TABLE public.sub_process_templates
  ADD COLUMN IF NOT EXISTS milestone_type_code text;

-- 2) Mapping des sous-étapes réglementaires BE vers les types du référentiel.
DO $$
DECLARE be_id uuid := 'bd75a3b0-c918-4b43-befe-739b83f7461a';
BEGIN
  UPDATE public.sub_process_templates SET milestone_type_code = 'pc_depot'
    WHERE process_template_id = be_id AND name = 'Permis de construire — Dépôt';
  UPDATE public.sub_process_templates SET milestone_type_code = 'pc_completude'
    WHERE process_template_id = be_id AND name = 'Permis de construire — Complétude obtenue';
  UPDATE public.sub_process_templates SET milestone_type_code = 'pc_arrete'
    WHERE process_template_id = be_id AND name = 'Permis de construire — Arrêté de PC';
  UPDATE public.sub_process_templates SET milestone_type_code = 'pc_purge'
    WHERE process_template_id = be_id AND name = 'Permis de construire — Purge';

  UPDATE public.sub_process_templates SET milestone_type_code = 'icpe_depot'
    WHERE process_template_id = be_id AND name IN (
      'ICPE Déclaration — Dépôt dossier',
      'ICPE Enregistrement — Dépôt de dossier + récépissé',
      'ICPE Autorisation — Dépôt + récépissé');
  UPDATE public.sub_process_templates SET milestone_type_code = 'icpe_completude'
    WHERE process_template_id = be_id AND name IN (
      'ICPE Déclaration — Complétude obtenue',
      'ICPE Enregistrement — Complétude obtenue');
  UPDATE public.sub_process_templates SET milestone_type_code = 'icpe_arrete'
    WHERE process_template_id = be_id AND name IN (
      'ICPE Enregistrement — Obtention de l''arrêté',
      'ICPE Autorisation — Arrêté préfectoral');
  UPDATE public.sub_process_templates SET milestone_type_code = 'icpe_purge'
    WHERE process_template_id = be_id AND name IN (
      'ICPE Déclaration — Purge',
      'ICPE Enregistrement — Purge',
      'ICPE Autorisation — Purge');

  UPDATE public.sub_process_templates SET milestone_type_code = 'agrement_depot'
    WHERE process_template_id = be_id AND name = 'Agrément sanitaire — Dépôt';
  UPDATE public.sub_process_templates SET milestone_type_code = 'agrement_definitif'
    WHERE process_template_id = be_id AND name = 'Agrément sanitaire — Agrément définitif';
END $$;

-- 3) Triggers : injecter type_code (lookup via sub_process_template_id).
CREATE OR REPLACE FUNCTION public.fn_be_task_milestone_on_start()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_today    DATE := CURRENT_DATE;
  v_target   DATE;
  v_label    TEXT;
  v_type     TEXT;
BEGIN
  IF NEW.is_milestone IS NOT TRUE THEN RETURN NEW; END IF;
  IF NEW.be_project_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.type <> 'task' THEN RETURN NEW; END IF;
  IF NEW.status IN ('done', 'validated', 'closed') THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM be_project_milestones
    WHERE source_task_id = NEW.id AND is_auto_delayed = FALSE
  ) THEN
    RETURN NEW;
  END IF;

  IF (
    (OLD.status = 'to_assign' AND NEW.status <> 'to_assign')
    OR (OLD.status <> 'in-progress' AND NEW.status = 'in-progress')
    OR (OLD.be_status IS DISTINCT FROM NEW.be_status
        AND NEW.be_status IN ('affectee', 'en_cours'))
  ) THEN
    v_label := COALESCE(NULLIF(TRIM(NEW.milestone_label), ''), NEW.title);
    v_target := COALESCE(NEW.due_date::date, v_today + INTERVAL '7 days');
    SELECT milestone_type_code INTO v_type
      FROM sub_process_templates WHERE id = NEW.sub_process_template_id;

    INSERT INTO be_project_milestones (
      be_project_id, titre, description, date_prevue, date_reelle,
      statut, source_task_id, is_auto_delayed, type_code
    ) VALUES (
      NEW.be_project_id, v_label,
      'Jalon prévu depuis la prise en charge de : ' || NEW.title,
      v_target, NULL,
      'en_cours', NEW.id, FALSE, v_type
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_be_task_milestone_on_complete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_completion_date DATE := CURRENT_DATE;
  v_label           TEXT;
  v_existing_id     UUID;
  v_type            TEXT;
BEGIN
  IF NEW.is_milestone IS NOT TRUE THEN RETURN NEW; END IF;
  IF NEW.be_project_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.type <> 'task' THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('done', 'validated', 'closed') THEN RETURN NEW; END IF;
  IF OLD.status IN ('done', 'validated', 'closed') THEN RETURN NEW; END IF;

  v_label := COALESCE(NULLIF(TRIM(NEW.milestone_label), ''), NEW.title);
  SELECT milestone_type_code INTO v_type
    FROM sub_process_templates WHERE id = NEW.sub_process_template_id;

  SELECT id INTO v_existing_id
  FROM be_project_milestones
  WHERE source_task_id = NEW.id AND is_auto_delayed = FALSE
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE be_project_milestones
    SET date_reelle = v_completion_date,
        statut      = 'termine',
        titre       = v_label,
        type_code   = COALESCE(v_type, type_code),
        updated_at  = NOW()
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO be_project_milestones (
      be_project_id, titre, description, date_prevue, date_reelle,
      statut, source_task_id, is_auto_delayed, type_code
    ) VALUES (
      NEW.be_project_id, v_label,
      'Jalon créé à la complétion (pas de prise en charge enregistrée)',
      v_completion_date, v_completion_date,
      'termine', NEW.id, FALSE, v_type
    );
  END IF;

  IF NEW.auto_milestone_delay_days IS NOT NULL AND NEW.auto_milestone_delay_days > 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM be_project_milestones
      WHERE source_task_id = NEW.id AND is_auto_delayed = TRUE
    ) THEN
      INSERT INTO be_project_milestones (
        be_project_id, titre, description, date_prevue,
        statut, source_task_id, is_auto_delayed
      ) VALUES (
        NEW.be_project_id,
        COALESCE(NULLIF(TRIM(NEW.auto_milestone_label), ''), v_label || ' — échéance'),
        'Jalon auto-différé (J+' || NEW.auto_milestone_delay_days || ') depuis : ' || NEW.title,
        v_completion_date + (NEW.auto_milestone_delay_days || ' days')::INTERVAL,
        'a_venir', NEW.id, TRUE
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4) Backfill des jalons existants depuis le mapping (remplace le backfill
--    par mot-clé du Lot 1 par le vrai type de la sous-étape source).
UPDATE public.be_project_milestones m
SET type_code = spt.milestone_type_code
FROM public.tasks t
JOIN public.sub_process_templates spt ON spt.id = t.sub_process_template_id
WHERE m.source_task_id = t.id
  AND spt.milestone_type_code IS NOT NULL;
