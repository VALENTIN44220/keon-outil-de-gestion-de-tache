-- Éclate le statut FDR unique (it_projects.statut_fdr) en 2 champs :
--   fdr_annee (AUCUNE=null / 2026 / 2027 / 2030 / 2035) + fdr_etat (non_soumis/soumis/validee).
-- L'« Inclus PDR » reste le booléen existant it_projects.sur_feuille_de_route.
-- statut_fdr est conservé en base (legacy) mais n'est plus utilisé en UI.
-- Appliquée en prod via MCP (migration it_fdr_split_annee_etat).

ALTER TABLE public.it_projects ADD COLUMN IF NOT EXISTS fdr_annee text;
ALTER TABLE public.it_projects ADD COLUMN IF NOT EXISTS fdr_etat text NOT NULL DEFAULT 'non_soumis';

UPDATE public.it_projects SET
  fdr_annee = CASE statut_fdr
    WHEN 'fdr_2026' THEN '2026'
    WHEN 'fdr_2027' THEN '2027'
    WHEN 'fdr_2030' THEN '2030'
    ELSE NULL END,
  fdr_etat = CASE
    WHEN statut_fdr IN ('fdr_2026','fdr_2027','fdr_2030','en_cours_validation') THEN 'soumis'
    ELSE 'non_soumis' END;
