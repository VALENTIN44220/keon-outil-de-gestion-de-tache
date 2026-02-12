
CREATE TABLE public.process_dashboard_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_template_id uuid NOT NULL REFERENCES public.process_templates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  widgets_config jsonb NOT NULL DEFAULT '[]'::jsonb,
  filters_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  columns_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(process_template_id, user_id)
);

ALTER TABLE public.process_dashboard_configs ENABLE ROW LEVEL SECURITY;

-- Users can read their own configs
CREATE POLICY "Users read own configs"
  ON public.process_dashboard_configs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users with write access can insert/update/delete their own configs
CREATE POLICY "Users manage own configs"
  ON public.process_dashboard_configs
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.can_write_process_tracking(process_template_id));

CREATE TRIGGER update_process_dashboard_configs_updated_at
  BEFORE UPDATE ON public.process_dashboard_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
