
-- Table to persist cross-filter preferences per user
CREATE TABLE public.user_dashboard_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filters jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_dashboard_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own filters"
  ON public.user_dashboard_filters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own filters"
  ON public.user_dashboard_filters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own filters"
  ON public.user_dashboard_filters FOR UPDATE
  USING (auth.uid() = user_id);
