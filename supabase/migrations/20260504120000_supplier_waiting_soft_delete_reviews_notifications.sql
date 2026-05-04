-- ============================================================
-- Soft delete + demande de modifications par champ + notifications
-- ============================================================

-- 1. Table notifications (in-app)
CREATE TABLE IF NOT EXISTS public.notifications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title               text NOT NULL,
  message             text NOT NULL,
  type                text NOT NULL,
  related_entity_type text,
  related_entity_id   uuid,
  read_at             timestamptz,
  created_at          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx    ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_select_own   ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY notifications_update_own   ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY notifications_insert_definer ON public.notifications FOR INSERT WITH CHECK (true);

-- 2. Soft delete sur supplier_waiting_approval
ALTER TABLE public.supplier_waiting_approval
  ADD COLUMN IF NOT EXISTS deleted_at         timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_reason    text,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Etendre le CHECK status pour inclure modifications_demandees
ALTER TABLE public.supplier_waiting_approval
  DROP CONSTRAINT IF EXISTS supplier_waiting_approval_status_check;
ALTER TABLE public.supplier_waiting_approval
  ADD CONSTRAINT supplier_waiting_approval_status_check
  CHECK (status IN ('a_completer', 'en_cours', 'complet', 'modifications_demandees'));

-- 3. Table des revues par champ
CREATE TABLE IF NOT EXISTS public.supplier_waiting_field_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waiting_id  uuid NOT NULL REFERENCES public.supplier_waiting_approval(id) ON DELETE CASCADE,
  field_key   text NOT NULL,
  comment     text NOT NULL,
  created_at  timestamptz DEFAULT now(),
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS supplier_waiting_field_reviews_waiting_id_idx
  ON public.supplier_waiting_field_reviews(waiting_id);

ALTER TABLE public.supplier_waiting_field_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY field_reviews_supplier_access ON public.supplier_waiting_field_reviews
  FOR ALL USING (public.has_supplier_access());
