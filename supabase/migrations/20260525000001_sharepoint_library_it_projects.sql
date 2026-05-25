-- Ajout colonne sharepoint_library_url sur it_projects
-- Permet d'associer une bibliothèque de documents SharePoint à chaque projet IT
ALTER TABLE public.it_projects
  ADD COLUMN IF NOT EXISTS sharepoint_library_url TEXT;

COMMENT ON COLUMN public.it_projects.sharepoint_library_url IS
  'URL directe vers la bibliothèque de documents SharePoint associée au projet (ex: https://keon.sharepoint.com/sites/…).';
