-- ============================================================================
-- SECURITY 002 — Journal d'audit des actions d'administration sensibles
-- Couvre : changements de rôles, visibilité des processus, simulations admin.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action      text NOT NULL,
  target_type text NOT NULL,
  target_id   text,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at
  ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target
  ON public.admin_audit_log (target_type, target_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Lecture : admins uniquement
DROP POLICY IF EXISTS "Admins can read audit log" ON public.admin_audit_log;
CREATE POLICY "Admins can read audit log"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Insertion : tout utilisateur authentifié (inserts applicatifs : simulations…)
DROP POLICY IF EXISTS "Authenticated can insert audit log" ON public.admin_audit_log;
CREATE POLICY "Authenticated can insert audit log"
  ON public.admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- Pas d'UPDATE / DELETE : journal en append-only.

-- ── Trigger : changements de rôles ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_user_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, payload)
  VALUES (
    auth.uid(),
    lower(TG_OP) || '_user_role',
    'user_roles',
    COALESCE(NEW.user_id, OLD.user_id)::text,
    jsonb_build_object(
      'old_role', CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN OLD.role::text END,
      'new_role', CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN NEW.role::text END
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_user_role_changes ON public.user_roles;
CREATE TRIGGER trg_log_user_role_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_user_role_changes();

-- ── Trigger : visibilité des processus (sociétés / services) ────────────────
CREATE OR REPLACE FUNCTION public.log_process_visibility_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, payload)
  VALUES (
    auth.uid(),
    lower(TG_OP) || '_process_visibility',
    TG_TABLE_NAME,
    COALESCE(NEW.process_template_id, OLD.process_template_id)::text,
    to_jsonb(COALESCE(NEW, OLD))
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_ptvc_changes ON public.process_template_visible_companies;
CREATE TRIGGER trg_log_ptvc_changes
  AFTER INSERT OR DELETE ON public.process_template_visible_companies
  FOR EACH ROW EXECUTE FUNCTION public.log_process_visibility_changes();

DROP TRIGGER IF EXISTS trg_log_ptvd_changes ON public.process_template_visible_departments;
CREATE TRIGGER trg_log_ptvd_changes
  AFTER INSERT OR DELETE ON public.process_template_visible_departments
  FOR EACH ROW EXECUTE FUNCTION public.log_process_visibility_changes();
