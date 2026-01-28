-- Create table for configuring accessible tables/columns for table_lookup fields
CREATE TABLE public.admin_table_lookup_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  display_column TEXT NOT NULL,
  value_column TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  filter_column TEXT,
  filter_value TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(table_name, display_column, value_column)
);

-- Enable RLS
ALTER TABLE public.admin_table_lookup_configs ENABLE ROW LEVEL SECURITY;

-- Only admins can manage configurations
CREATE POLICY "Admins can manage table lookup configs"
  ON public.admin_table_lookup_configs
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- All authenticated users can view active configs
CREATE POLICY "Authenticated users can view active configs"
  ON public.admin_table_lookup_configs
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

-- Create trigger for updated_at
CREATE TRIGGER update_admin_table_lookup_configs_updated_at
  BEFORE UPDATE ON public.admin_table_lookup_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default configurations for common tables
INSERT INTO public.admin_table_lookup_configs (table_name, display_column, value_column, label, description, order_index) VALUES
  ('profiles', 'display_name', 'id', 'Utilisateurs', 'Liste des utilisateurs du système', 1),
  ('departments', 'name', 'id', 'Services', 'Liste des services/départements', 2),
  ('companies', 'name', 'id', 'Sociétés', 'Liste des sociétés', 3),
  ('job_titles', 'name', 'id', 'Postes', 'Liste des postes/fonctions', 4),
  ('be_projects', 'nom_projet', 'id', 'Projets BE', 'Liste des projets BE', 5),
  ('categories', 'name', 'id', 'Catégories', 'Liste des catégories', 6),
  ('collaborator_groups', 'name', 'id', 'Groupes', 'Liste des groupes de collaborateurs', 7);