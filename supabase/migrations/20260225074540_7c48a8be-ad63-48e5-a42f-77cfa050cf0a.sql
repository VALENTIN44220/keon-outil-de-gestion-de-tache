
-- Table des étiquettes par groupe de services
CREATE TABLE public.service_group_labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_group_id UUID NOT NULL REFERENCES public.service_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(service_group_id, name)
);

-- Enable RLS
ALTER TABLE public.service_group_labels ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read labels
CREATE POLICY "Authenticated users can read labels"
  ON public.service_group_labels FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admins can manage labels
CREATE POLICY "Admins can manage labels"
  ON public.service_group_labels FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Junction table: task <-> service_group_label (many-to-many)
CREATE TABLE public.task_labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.service_group_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, label_id)
);

-- Enable RLS
ALTER TABLE public.task_labels ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read task labels
CREATE POLICY "Authenticated users can read task labels"
  ON public.task_labels FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Authenticated users can manage task labels
CREATE POLICY "Authenticated users can manage task labels"
  ON public.task_labels FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete task labels"
  ON public.task_labels FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Add trigger for updated_at on service_group_labels
CREATE TRIGGER update_service_group_labels_updated_at
  BEFORE UPDATE ON public.service_group_labels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
