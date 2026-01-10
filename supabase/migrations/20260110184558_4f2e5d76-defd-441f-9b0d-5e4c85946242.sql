-- Create categories table
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create subcategories table
CREATE TABLE public.subcategories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(category_id, name)
);

-- Add new fields to tasks table for requester and reporter
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS requester_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS reporter_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id),
ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES public.subcategories(id);

-- Add category/subcategory references to task_templates
ALTER TABLE public.task_templates
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id),
ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES public.subcategories(id);

-- Enable RLS on categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view categories"
ON public.categories FOR SELECT
USING (true);

CREATE POLICY "Admins can manage categories"
ON public.categories FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can insert categories"
ON public.categories FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Enable RLS on subcategories
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view subcategories"
ON public.subcategories FOR SELECT
USING (true);

CREATE POLICY "Admins can manage subcategories"
ON public.subcategories FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can insert subcategories"
ON public.subcategories FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Insert standard categories
INSERT INTO public.categories (name, description) VALUES
('IT', 'Technologies de l''information'),
('RH', 'Ressources Humaines'),
('Finance', 'Comptabilité et Finance'),
('Marketing', 'Marketing et Communication'),
('Opérations', 'Opérations et Logistique'),
('Juridique', 'Affaires Juridiques'),
('Commercial', 'Ventes et Relations Clients'),
('Administratif', 'Administration Générale');

-- Insert subcategories for IT
INSERT INTO public.subcategories (category_id, name, description)
SELECT id, 'Matériel', 'Équipements informatiques' FROM public.categories WHERE name = 'IT'
UNION ALL
SELECT id, 'Digital', 'Applications et services numériques' FROM public.categories WHERE name = 'IT'
UNION ALL
SELECT id, 'Dépannage', 'Support technique et résolution de problèmes' FROM public.categories WHERE name = 'IT'
UNION ALL
SELECT id, 'Maintenance', 'Maintenance préventive et corrective' FROM public.categories WHERE name = 'IT'
UNION ALL
SELECT id, 'Sécurité', 'Cybersécurité et protection des données' FROM public.categories WHERE name = 'IT';

-- Insert subcategories for RH
INSERT INTO public.subcategories (category_id, name, description)
SELECT id, 'Recrutement', 'Processus de recrutement' FROM public.categories WHERE name = 'RH'
UNION ALL
SELECT id, 'Formation', 'Formation et développement' FROM public.categories WHERE name = 'RH'
UNION ALL
SELECT id, 'Onboarding', 'Intégration des nouveaux employés' FROM public.categories WHERE name = 'RH'
UNION ALL
SELECT id, 'Offboarding', 'Départ des employés' FROM public.categories WHERE name = 'RH'
UNION ALL
SELECT id, 'Paie', 'Gestion de la paie' FROM public.categories WHERE name = 'RH';

-- Insert subcategories for Finance
INSERT INTO public.subcategories (category_id, name, description)
SELECT id, 'Facturation', 'Émission et suivi des factures' FROM public.categories WHERE name = 'Finance'
UNION ALL
SELECT id, 'Comptabilité', 'Opérations comptables' FROM public.categories WHERE name = 'Finance'
UNION ALL
SELECT id, 'Budget', 'Gestion budgétaire' FROM public.categories WHERE name = 'Finance'
UNION ALL
SELECT id, 'Trésorerie', 'Gestion de la trésorerie' FROM public.categories WHERE name = 'Finance';

-- Insert subcategories for Marketing
INSERT INTO public.subcategories (category_id, name, description)
SELECT id, 'Communication', 'Communication interne et externe' FROM public.categories WHERE name = 'Marketing'
UNION ALL
SELECT id, 'Événements', 'Organisation d''événements' FROM public.categories WHERE name = 'Marketing'
UNION ALL
SELECT id, 'Digital', 'Marketing digital' FROM public.categories WHERE name = 'Marketing'
UNION ALL
SELECT id, 'Contenu', 'Création de contenu' FROM public.categories WHERE name = 'Marketing';

-- Insert subcategories for Opérations
INSERT INTO public.subcategories (category_id, name, description)
SELECT id, 'Logistique', 'Gestion logistique' FROM public.categories WHERE name = 'Opérations'
UNION ALL
SELECT id, 'Achats', 'Gestion des achats' FROM public.categories WHERE name = 'Opérations'
UNION ALL
SELECT id, 'Stock', 'Gestion des stocks' FROM public.categories WHERE name = 'Opérations'
UNION ALL
SELECT id, 'Production', 'Gestion de la production' FROM public.categories WHERE name = 'Opérations';

-- Insert subcategories for Juridique
INSERT INTO public.subcategories (category_id, name, description)
SELECT id, 'Contrats', 'Gestion des contrats' FROM public.categories WHERE name = 'Juridique'
UNION ALL
SELECT id, 'Conformité', 'Conformité réglementaire' FROM public.categories WHERE name = 'Juridique'
UNION ALL
SELECT id, 'Litiges', 'Gestion des litiges' FROM public.categories WHERE name = 'Juridique';

-- Insert subcategories for Commercial
INSERT INTO public.subcategories (category_id, name, description)
SELECT id, 'Prospection', 'Prospection commerciale' FROM public.categories WHERE name = 'Commercial'
UNION ALL
SELECT id, 'Négociation', 'Négociation et closing' FROM public.categories WHERE name = 'Commercial'
UNION ALL
SELECT id, 'SAV', 'Service après-vente' FROM public.categories WHERE name = 'Commercial'
UNION ALL
SELECT id, 'Fidélisation', 'Fidélisation clients' FROM public.categories WHERE name = 'Commercial';

-- Insert subcategories for Administratif
INSERT INTO public.subcategories (category_id, name, description)
SELECT id, 'Courrier', 'Gestion du courrier' FROM public.categories WHERE name = 'Administratif'
UNION ALL
SELECT id, 'Archives', 'Archivage et documentation' FROM public.categories WHERE name = 'Administratif'
UNION ALL
SELECT id, 'Accueil', 'Accueil et standard' FROM public.categories WHERE name = 'Administratif';

-- Create triggers for updated_at
CREATE TRIGGER update_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subcategories_updated_at
BEFORE UPDATE ON public.subcategories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();