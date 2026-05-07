-- ============================================================
-- MODULES 012 — Numerotation par module + prestation
-- ============================================================
-- Avant : D-PERSO-0001 / D-PERSO-0002... pour TOUTES les demandes
-- non-BE -> illisible.
--
-- Apres : D-{MODULE}-{PRESTATION}-{NUM} ou
--   - MODULE = code court du module (IT, LOG, MAINT, INNO, COMM, RH)
--   - PRESTATION = short_code defini dans process_template.settings.short_code
--     (optionnel, ex. DIVALTO, INTERV, TRANSP, MATERIEL)
--   - NUM = compteur incremental par cle (MODULE-PRESTATION)
--
-- Exemples : D-IT-DIVALTO-0001, D-IT-INTERV-0001, D-LOG-TRANSP-0001,
-- D-MAINT-MATERIEL-0001, D-INNO-NEWB-0001
--
-- Backward compat :
--  - BE conserve son schema (D-{PROJET}-XXXX) car il a une notion de
--    dossier client.
--  - PERSO reste pour les taches sans module (tache perso, etc.).
-- ============================================================

-- 1. Definit short_code dans settings pour chaque process_template module
UPDATE process_templates SET settings = settings || jsonb_build_object('short_code', 'MATERIEL')
WHERE id = '11111111-1111-4111-8111-111111111101';
UPDATE process_templates SET settings = settings || jsonb_build_object('short_code', 'TRANSP')
WHERE id = '11111111-1111-4111-8111-111111111201';
UPDATE process_templates SET settings = settings || jsonb_build_object('short_code', 'SHARE')
WHERE id = '11111111-1111-4111-8111-111111111301';
UPDATE process_templates SET settings = settings || jsonb_build_object('short_code', 'DIVALTO')
WHERE id = '11111111-1111-4111-8111-111111111302';
UPDATE process_templates SET settings = settings || jsonb_build_object('short_code', 'PIPED')
WHERE id = '11111111-1111-4111-8111-111111111303';
UPDATE process_templates SET settings = settings || jsonb_build_object('short_code', 'LUCCA')
WHERE id = '11111111-1111-4111-8111-111111111304';
UPDATE process_templates SET settings = settings || jsonb_build_object('short_code', 'POWBI')
WHERE id = '11111111-1111-4111-8111-111111111305';
UPDATE process_templates SET settings = settings || jsonb_build_object('short_code', 'INTERV')
WHERE id = '11111111-1111-4111-8111-111111111306';
UPDATE process_templates SET settings = settings || jsonb_build_object('short_code', 'MATBUR')
WHERE id = '11111111-1111-4111-8111-111111111307';
UPDATE process_templates SET settings = settings || jsonb_build_object('short_code', 'TICKET')
WHERE id = '11111111-1111-4111-8111-111111111308';
UPDATE process_templates SET settings = settings || jsonb_build_object('short_code', 'COMM')
WHERE id = '11111111-1111-4111-8111-111111111401';
UPDATE process_templates SET settings = settings || jsonb_build_object('short_code', 'STAND')
WHERE id = '11111111-1111-4111-8111-111111111402';
UPDATE process_templates SET settings = settings || jsonb_build_object('short_code', 'NEWB')
WHERE id = '11111111-1111-4111-8111-111111111501';
UPDATE process_templates SET settings = settings || jsonb_build_object('short_code', 'MAJ')
WHERE id = '11111111-1111-4111-8111-111111111502';
UPDATE process_templates SET settings = settings || jsonb_build_object('short_code', 'ONB')
WHERE id = '11111111-1111-4111-8111-111111111601';
UPDATE process_templates SET settings = settings || jsonb_build_object('short_code', 'OFFB')
WHERE id = '11111111-1111-4111-8111-111111111602';
UPDATE process_templates SET settings = settings || jsonb_build_object('short_code', 'MUT')
WHERE id = '11111111-1111-4111-8111-111111111603';
UPDATE process_templates SET settings = settings || jsonb_build_object('short_code', 'PROMO')
WHERE id = '11111111-1111-4111-8111-111111111604';

-- 2. Met a jour assign_task_number pour utiliser module_code + short_code
CREATE OR REPLACE FUNCTION public.assign_task_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_project_code text;
  v_entity_type text;
  v_number text;
  v_module text;
  v_short_code text;
  v_settings jsonb;
BEGIN
  -- Cas 1 : tache liee a un projet BE (be_project_id ou parent_request_id) -> code du projet
  v_project_code := public.get_project_code_for_entity(NEW.be_project_id, NEW.parent_request_id);

  -- Cas 2 : module_code defini -> {MODULE}-{SHORT_CODE}
  IF v_project_code IS NULL AND NEW.module_code IS NOT NULL THEN
    v_module := upper(NEW.module_code::text);
    -- Lecture short_code depuis le process_template
    IF NEW.source_process_template_id IS NOT NULL THEN
      SELECT settings INTO v_settings FROM public.process_templates WHERE id = NEW.source_process_template_id;
      IF v_settings IS NOT NULL AND v_settings ? 'short_code' THEN
        v_short_code := v_settings->>'short_code';
      END IF;
    END IF;
    IF v_short_code IS NOT NULL THEN
      v_project_code := v_module || '-' || v_short_code;
    ELSE
      v_project_code := v_module;
    END IF;
  END IF;

  -- Fallback : PERSO
  IF v_project_code IS NULL THEN
    v_project_code := 'PERSO';
  END IF;

  IF NEW.type = 'request' THEN
    v_entity_type := 'request';
    IF NEW.request_number IS NULL THEN
      v_number := public.next_entity_number(v_project_code, v_entity_type);
      NEW.request_number := v_number;
      IF NEW.title IS NOT NULL AND NOT NEW.title LIKE v_number || ' — %' AND NOT NEW.title LIKE v_number || '%' THEN
        NEW.title := v_number || ' — ' || NEW.title;
      ELSIF NEW.title IS NULL OR NEW.title = '' THEN
        NEW.title := v_number;
      END IF;
    END IF;
  ELSIF NEW.type = 'task' THEN
    v_entity_type := 'task';
    IF NEW.task_number IS NULL THEN
      v_number := public.next_entity_number(v_project_code, v_entity_type);
      NEW.task_number := v_number;
      IF NEW.title IS NOT NULL AND NOT NEW.title LIKE v_number || ' — %' AND NOT NEW.title LIKE v_number || '%' THEN
        NEW.title := v_number || ' — ' || NEW.title;
      ELSIF NEW.title IS NULL OR NEW.title = '' THEN
        NEW.title := v_number;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;

-- 3. Idem pour insert_task_trace_number_after_insert
CREATE OR REPLACE FUNCTION public.insert_task_trace_number_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_project_code text;
  v_request_number text;
  v_module text;
  v_short_code text;
  v_settings jsonb;
BEGIN
  v_project_code := public.get_project_code_for_entity(NEW.be_project_id, NEW.parent_request_id);

  IF v_project_code IS NULL AND NEW.module_code IS NOT NULL THEN
    v_module := upper(NEW.module_code::text);
    IF NEW.source_process_template_id IS NOT NULL THEN
      SELECT settings INTO v_settings FROM public.process_templates WHERE id = NEW.source_process_template_id;
      IF v_settings IS NOT NULL AND v_settings ? 'short_code' THEN
        v_short_code := v_settings->>'short_code';
      END IF;
    END IF;
    IF v_short_code IS NOT NULL THEN
      v_project_code := v_module || '-' || v_short_code;
    ELSE
      v_project_code := v_module;
    END IF;
  END IF;

  IF v_project_code IS NULL THEN
    v_project_code := 'PERSO';
  END IF;

  IF NEW.type = 'request' THEN
    IF NEW.request_number IS NOT NULL THEN
      INSERT INTO public.request_trace_numbers (project_code, request_id, request_number)
      VALUES (v_project_code, NEW.id, NEW.request_number);
    END IF;
  ELSIF NEW.type = 'task' THEN
    SELECT t.request_number INTO v_request_number FROM public.tasks t WHERE t.id = NEW.parent_request_id;
    IF NEW.task_number IS NOT NULL THEN
      INSERT INTO public.request_trace_numbers (
        project_code, task_id, task_number, request_id, request_number
      ) VALUES (
        v_project_code, NEW.id, NEW.task_number, NEW.parent_request_id, v_request_number
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;
