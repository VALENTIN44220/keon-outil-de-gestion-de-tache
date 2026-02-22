-- Table to store which pages are visible on which device types
CREATE TABLE public.page_device_visibility (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id TEXT NOT NULL,
  page_label TEXT NOT NULL,
  visible_on_desktop BOOLEAN NOT NULL DEFAULT true,
  visible_on_tablet BOOLEAN NOT NULL DEFAULT true,
  visible_on_mobile BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(page_id)
);

-- Enable RLS
ALTER TABLE public.page_device_visibility ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read
CREATE POLICY "Authenticated users can read page visibility"
ON public.page_device_visibility
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only admins can modify
CREATE POLICY "Admins can manage page visibility"
ON public.page_device_visibility
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed with all pages (all visible by default)
INSERT INTO public.page_device_visibility (page_id, page_label) VALUES
  ('dashboard', 'Tableau de bord'),
  ('requests', 'Demandes'),
  ('process-tracking', 'Suivi des processus'),
  ('workload', 'Plan de charge'),
  ('team', 'Équipe'),
  ('projects', 'Projets'),
  ('suppliers', 'Fournisseurs'),
  ('templates', 'Modèles'),
  ('calendar', 'Calendrier'),
  ('admin', 'Administration'),
  ('chat', 'Messages');

-- Trigger for updated_at
CREATE TRIGGER update_page_device_visibility_updated_at
BEFORE UPDATE ON public.page_device_visibility
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
