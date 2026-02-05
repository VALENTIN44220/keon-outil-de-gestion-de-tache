
-- =====================================================
-- NUMÉROTATION INCRÉMENTIELLE DEMANDES/SP/TÂCHES
-- =====================================================

-- 1. TABLE DES COMPTEURS (concurrence-safe)
CREATE TABLE IF NOT EXISTS public.number_counters (
  project_code text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('request', 'sub_process', 'task')),
  last_value bigint NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (project_code, entity_type)
);

-- RLS pour number_counters (accessible seulement via fonctions SECURITY DEFINER)
ALTER TABLE public.number_counters ENABLE ROW LEVEL SECURITY;

-- 2. TABLE DE TRAÇABILITÉ
CREATE TABLE IF NOT EXISTS public.request_trace_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code text NOT NULL,
  request_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  request_number text,
  sub_process_instance_id uuid REFERENCES public.request_sub_processes(id) ON DELETE SET NULL,
  sub_process_number text,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  task_number text,
  created_at timestamptz DEFAULT now()
);

-- Indexes pour traçabilité
CREATE UNIQUE INDEX IF NOT EXISTS idx_trace_request_number ON public.request_trace_numbers(request_number) WHERE request_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_trace_sp_number ON public.request_trace_numbers(sub_process_number) WHERE sub_process_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_trace_task_number ON public.request_trace_numbers(task_number) WHERE task_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trace_entities ON public.request_trace_numbers(request_id, sub_process_instance_id, task_id);
CREATE INDEX IF NOT EXISTS idx_trace_project ON public.request_trace_numbers(project_code);

-- RLS pour request_trace_numbers
ALTER TABLE public.request_trace_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view trace numbers"
  ON public.request_trace_numbers FOR SELECT
  TO authenticated
  USING (true);

-- 3. AJOUTER LES COLONNES DE NUMÉROTATION

-- tasks (request_number et task_number)
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS request_number text,
ADD COLUMN IF NOT EXISTS task_number text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_request_number ON public.tasks(request_number) WHERE request_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_task_number ON public.tasks(task_number) WHERE task_number IS NOT NULL;

-- request_sub_processes (sub_process_number)
ALTER TABLE public.request_sub_processes
ADD COLUMN IF NOT EXISTS sub_process_number text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rsp_sub_process_number ON public.request_sub_processes(sub_process_number) WHERE sub_process_number IS NOT NULL;

-- 4. FONCTION ATOMIQUE POUR GÉNÉRER LES NUMÉROS
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
  
  RETURN v_result;
END;
$$;

-- 5. FONCTION HELPER POUR OBTENIR LE CODE PROJET
CREATE OR REPLACE FUNCTION public.get_project_code_for_entity(
  p_be_project_id uuid DEFAULT NULL,
  p_parent_request_id uuid DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  -- Cas 1: be_project_id direct
  IF p_be_project_id IS NOT NULL THEN
    SELECT code_projet INTO v_code
    FROM public.be_projects
    WHERE id = p_be_project_id;
    
    IF v_code IS NOT NULL THEN
      RETURN v_code;
    END IF;
  END IF;
  
  -- Cas 2: via parent_request_id
  IF p_parent_request_id IS NOT NULL THEN
    SELECT bp.code_projet INTO v_code
    FROM public.tasks t
    JOIN public.be_projects bp ON bp.id = t.be_project_id
    WHERE t.id = p_parent_request_id;
    
    IF v_code IS NOT NULL THEN
      RETURN v_code;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$;

-- 6. TRIGGER POUR TASKS (demandes et tâches)
CREATE OR REPLACE FUNCTION public.assign_task_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_code text;
  v_entity_type text;
  v_number text;
BEGIN
  -- Déterminer le code projet
  v_project_code := public.get_project_code_for_entity(NEW.be_project_id, NEW.parent_request_id);
  
  -- Si pas de code projet, on ne numérote pas
  IF v_project_code IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Déterminer le type d'entité
  IF NEW.type = 'request' THEN
    v_entity_type := 'request';
    
    -- Générer le numéro si pas déjà défini
    IF NEW.request_number IS NULL THEN
      v_number := public.next_entity_number(v_project_code, v_entity_type);
      NEW.request_number := v_number;
      
      -- Préfixer le titre si pas déjà fait
      IF NEW.title IS NOT NULL AND NOT NEW.title LIKE v_number || ' — %' AND NOT NEW.title LIKE v_number || '%' THEN
        NEW.title := v_number || ' — ' || NEW.title;
      ELSIF NEW.title IS NULL OR NEW.title = '' THEN
        NEW.title := v_number;
      END IF;
      
      -- Insérer dans la table de traçabilité
      INSERT INTO public.request_trace_numbers (project_code, request_id, request_number)
      VALUES (v_project_code, NEW.id, v_number);
    END IF;
    
  ELSIF NEW.type = 'task' THEN
    v_entity_type := 'task';
    
    -- Générer le numéro si pas déjà défini
    IF NEW.task_number IS NULL THEN
      v_number := public.next_entity_number(v_project_code, v_entity_type);
      NEW.task_number := v_number;
      
      -- Préfixer le titre si pas déjà fait
      IF NEW.title IS NOT NULL AND NOT NEW.title LIKE v_number || ' — %' AND NOT NEW.title LIKE v_number || '%' THEN
        NEW.title := v_number || ' — ' || NEW.title;
      ELSIF NEW.title IS NULL OR NEW.title = '' THEN
        NEW.title := v_number;
      END IF;
      
      -- Insérer dans la table de traçabilité (lier à la demande parente si existe)
      INSERT INTO public.request_trace_numbers (
        project_code, 
        task_id, 
        task_number,
        request_id,
        request_number
      )
      SELECT 
        v_project_code,
        NEW.id,
        v_number,
        NEW.parent_request_id,
        t.request_number
      FROM (SELECT 1) dummy
      LEFT JOIN public.tasks t ON t.id = NEW.parent_request_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Créer le trigger pour tasks
DROP TRIGGER IF EXISTS trg_assign_task_number ON public.tasks;
CREATE TRIGGER trg_assign_task_number
  BEFORE INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_task_number();

-- 7. TRIGGER POUR REQUEST_SUB_PROCESSES
CREATE OR REPLACE FUNCTION public.assign_sub_process_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_code text;
  v_number text;
  v_request_number text;
BEGIN
  -- Obtenir le code projet via la demande parente
  SELECT 
    bp.code_projet,
    t.request_number
  INTO v_project_code, v_request_number
  FROM public.tasks t
  LEFT JOIN public.be_projects bp ON bp.id = t.be_project_id
  WHERE t.id = NEW.request_id;
  
  -- Si pas de code projet, ne pas numéroter
  IF v_project_code IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Générer le numéro si pas déjà défini
  IF NEW.sub_process_number IS NULL THEN
    v_number := public.next_entity_number(v_project_code, 'sub_process');
    NEW.sub_process_number := v_number;
    
    -- Insérer dans la table de traçabilité
    INSERT INTO public.request_trace_numbers (
      project_code,
      sub_process_instance_id,
      sub_process_number,
      request_id,
      request_number
    )
    VALUES (
      v_project_code,
      NEW.id,
      v_number,
      NEW.request_id,
      v_request_number
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Créer le trigger pour request_sub_processes
DROP TRIGGER IF EXISTS trg_assign_sub_process_number ON public.request_sub_processes;
CREATE TRIGGER trg_assign_sub_process_number
  BEFORE INSERT ON public.request_sub_processes
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_sub_process_number();

-- 8. Indexes de recherche par numéro
CREATE INDEX IF NOT EXISTS idx_tasks_request_number_search ON public.tasks(request_number text_pattern_ops) WHERE request_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_task_number_search ON public.tasks(task_number text_pattern_ops) WHERE task_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rsp_sp_number_search ON public.request_sub_processes(sub_process_number text_pattern_ops) WHERE sub_process_number IS NOT NULL;
