
-- Table for saved filter presets per user
CREATE TABLE public.user_filter_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  process_template_id UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_filter_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own filter presets"
ON public.user_filter_presets
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_user_filter_presets_user ON public.user_filter_presets(user_id);
