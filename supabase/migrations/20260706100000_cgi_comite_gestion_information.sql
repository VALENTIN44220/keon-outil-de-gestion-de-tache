-- ============================================================
-- CGI — Comite de Gestion de l'Information
-- ============================================================
-- Module de suivi trimestriel de la gouvernance IT.
-- Les seances sont dans une table dediee ; les actions/decisions
-- sont des taches (tasks.module_code='cgi') pour beneficier du
-- tableau de bord, notifications, commentaires et historique.
-- ============================================================

-- ========== 1. Ajout de la valeur 'cgi' a l'enum module_code ==========
ALTER TYPE public.module_code ADD VALUE IF NOT EXISTS 'cgi';

-- ========== 2. Table cgi_sessions ==========
CREATE TABLE IF NOT EXISTS public.cgi_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trimestre   text NOT NULL,
  date_seance date NOT NULL,
  ordre_du_jour text,
  compte_rendu  text,
  -- Participants par fonction (DG, RSI, DAF, etc.)
  -- Format : [{"fonction":"RSI","profile_id":"abc-123"}, {"fonction":"DG","profile_id":null}]
  participants  jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by  uuid REFERENCES public.profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT cgi_sessions_trimestre_unique UNIQUE (trimestre)
);

COMMENT ON TABLE public.cgi_sessions IS
  'Seances trimestrielles du Comite de Gestion de l Information.';

-- updated_at auto
CREATE OR REPLACE FUNCTION public.cgi_sessions_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_cgi_sessions_updated ON public.cgi_sessions;
CREATE TRIGGER trg_cgi_sessions_updated
  BEFORE UPDATE ON public.cgi_sessions
  FOR EACH ROW EXECUTE FUNCTION public.cgi_sessions_set_updated_at();

-- RLS
ALTER TABLE public.cgi_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cgi_sessions_select_authenticated"
  ON public.cgi_sessions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "cgi_sessions_insert_authenticated"
  ON public.cgi_sessions FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "cgi_sessions_update_authenticated"
  ON public.cgi_sessions FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "cgi_sessions_delete_authenticated"
  ON public.cgi_sessions FOR DELETE
  TO authenticated USING (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_cgi_sessions_date
  ON public.cgi_sessions (date_seance DESC);

-- ========== 3. Index tasks CGI ==========
CREATE INDEX IF NOT EXISTS idx_tasks_module_cgi
  ON public.tasks (created_at DESC)
  WHERE module_code = 'cgi';

-- ========== 4. Trigger notification a la creation d'une action CGI ==========
CREATE OR REPLACE FUNCTION public.handle_cgi_action_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_assignee_user_id uuid;
  v_creator_name     text;
  v_session_label    text;
BEGIN
  IF NEW.type IS DISTINCT FROM 'task' THEN RETURN NEW; END IF;
  IF NEW.module_code IS DISTINCT FROM 'cgi'::public.module_code THEN RETURN NEW; END IF;

  -- Pas d'assignee = pas de notif
  IF NEW.assignee_id IS NULL THEN RETURN NEW; END IF;

  -- Resoudre le user_id de l'assignee
  SELECT user_id INTO v_assignee_user_id
  FROM public.profiles WHERE id = NEW.assignee_id;

  IF v_assignee_user_id IS NULL THEN RETURN NEW; END IF;

  -- Ne pas se notifier soi-meme
  IF v_assignee_user_id = auth.uid() THEN RETURN NEW; END IF;

  -- Nom du createur
  SELECT COALESCE(display_name, 'Quelqu''un') INTO v_creator_name
  FROM public.profiles WHERE user_id = auth.uid();

  -- Label session (trimestre)
  IF NEW.module_data ? 'session_id' THEN
    SELECT trimestre INTO v_session_label
    FROM public.cgi_sessions
    WHERE id = (NEW.module_data->>'session_id')::uuid;
  END IF;
  v_session_label := COALESCE(v_session_label, 'CGI');

  INSERT INTO public.notifications (user_id, title, message, type, related_entity_type, related_entity_id)
  VALUES (
    v_assignee_user_id,
    'Action Comite GI',
    v_creator_name || ' vous a assigne une action (' || v_session_label || ') : ' || COALESCE(NEW.title, 'sans titre'),
    'cgi_action_assigned',
    'task',
    NEW.id
  );

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_cgi_action_created ON public.tasks;
CREATE TRIGGER trg_cgi_action_created
  AFTER INSERT ON public.tasks
  FOR EACH ROW
  WHEN (NEW.module_code = 'cgi')
  EXECUTE FUNCTION public.handle_cgi_action_created();

COMMENT ON FUNCTION public.handle_cgi_action_created() IS
  'Notifie l assignee lors de la creation d une action du Comite de Gestion de l Information.';
