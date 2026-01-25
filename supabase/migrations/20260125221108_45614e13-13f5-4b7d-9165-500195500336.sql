-- Table for storing project view configurations (standard and custom)
CREATE TABLE public.project_view_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  view_type TEXT NOT NULL CHECK (view_type IN ('standard', 'custom')),
  visible_columns TEXT[] NOT NULL DEFAULT '{}',
  column_order TEXT[] NOT NULL DEFAULT '{}',
  column_filters JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_view_type UNIQUE (user_id, view_type)
);

-- Enable RLS
ALTER TABLE public.project_view_configs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view standard configs (where user_id is null) and their own custom configs
CREATE POLICY "Users can view standard and own configs"
  ON public.project_view_configs FOR SELECT
  USING (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));

-- Policy: Only admins can manage standard configs
CREATE POLICY "Admins can manage standard configs"
  ON public.project_view_configs FOR ALL
  USING (user_id IS NULL AND has_role(auth.uid(), 'admin'::app_role));

-- Policy: Users can manage their own custom configs
CREATE POLICY "Users can manage own custom configs"
  ON public.project_view_configs FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_project_view_configs_updated_at
  BEFORE UPDATE ON public.project_view_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();