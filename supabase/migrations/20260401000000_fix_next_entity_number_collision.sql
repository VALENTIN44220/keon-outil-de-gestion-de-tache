-- =====================================================
-- Fix: avoid collisions with UNIQUE trace indexes
-- - Keep UNIQUE indexes (idx_trace_request_number / idx_trace_sp_number / idx_trace_task_number)
-- - Make number generation skip already-used numbers
-- =====================================================

CREATE OR REPLACE FUNCTION public.next_entity_number(
  p_project_code text,
  p_entity_type text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_value bigint;
  v_prefix text;
  v_padding int;
  v_result text;
  v_attempts int := 0;
  v_exists boolean;
BEGIN
  -- Définir préfixe et padding selon le type
  CASE p_entity_type
    WHEN 'request' THEN
      v_prefix := 'D';
      v_padding := 5;
    WHEN 'sub_process' THEN
      v_prefix := 'SP';
      v_padding := 5;
    WHEN 'task' THEN
      v_prefix := 'T';
      v_padding := 4;
    ELSE
      RAISE EXCEPTION 'Type d''entité invalide: %', p_entity_type;
  END CASE;

  LOOP
    v_attempts := v_attempts + 1;
    IF v_attempts > 50 THEN
      RAISE EXCEPTION 'Impossible de générer un numéro unique pour %, projet % (trop de collisions)', p_entity_type, p_project_code;
    END IF;

    -- Incrémenter atomiquement le compteur (INSERT ... ON CONFLICT ... DO UPDATE)
    INSERT INTO public.number_counters (project_code, entity_type, last_value, updated_at)
    VALUES (p_project_code, p_entity_type, 1, now())
    ON CONFLICT (project_code, entity_type)
    DO UPDATE SET
      last_value = number_counters.last_value + 1,
      updated_at = now()
    RETURNING last_value INTO v_next_value;

    -- Formater le numéro final
    v_result := v_prefix || '-' || p_project_code || '-' || LPAD(v_next_value::text, v_padding, '0');

    -- Vérifier collisions dans les tables qui ont une unicité sur ces numéros
    v_exists := false;

    IF p_entity_type = 'request' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.request_trace_numbers rtn WHERE rtn.request_number = v_result
      ) OR EXISTS (
        SELECT 1 FROM public.tasks t WHERE t.request_number = v_result
      )
      INTO v_exists;
    ELSIF p_entity_type = 'sub_process' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.request_trace_numbers rtn WHERE rtn.sub_process_number = v_result
      ) OR EXISTS (
        SELECT 1 FROM public.request_sub_processes rsp WHERE rsp.sub_process_number = v_result
      )
      INTO v_exists;
    ELSIF p_entity_type = 'task' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.request_trace_numbers rtn WHERE rtn.task_number = v_result
      ) OR EXISTS (
        SELECT 1 FROM public.tasks t WHERE t.task_number = v_result
      )
      INTO v_exists;
    END IF;

    IF NOT v_exists THEN
      RETURN v_result;
    END IF;
  END LOOP;
END;
$$;

