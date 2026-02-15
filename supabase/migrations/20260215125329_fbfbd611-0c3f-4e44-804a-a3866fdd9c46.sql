
-- Table des groupes de services
CREATE TABLE public.service_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table de liaison groupe <-> département
CREATE TABLE public.service_group_departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_group_id UUID NOT NULL REFERENCES public.service_groups(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(service_group_id, department_id)
);

-- Ajouter service_group_id sur process_templates
ALTER TABLE public.process_templates ADD COLUMN service_group_id UUID REFERENCES public.service_groups(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE public.service_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_group_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read service_groups" ON public.service_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage service_groups" ON public.service_groups FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read service_group_departments" ON public.service_group_departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage service_group_departments" ON public.service_group_departments FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
CREATE TRIGGER update_service_groups_updated_at BEFORE UPDATE ON public.service_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_group_departments;
