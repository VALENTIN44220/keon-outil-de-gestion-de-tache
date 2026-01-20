-- Add region and department columns to be_projects
ALTER TABLE public.be_projects
ADD COLUMN region TEXT,
ADD COLUMN departement TEXT;