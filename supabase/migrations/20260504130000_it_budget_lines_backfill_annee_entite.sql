-- Backfill annee / entite sur it_budget_lines pour les lignes créées
-- depuis l'onglet "Budget" d'un projet IT, qui jusque-là n'étaient pas
-- visibles dans la page Budget IT globale (filtre .eq('annee', ...)).
--
-- - annee : recopiée depuis exercice quand elle est NULL.
-- - entite : déduite du nom de la company associée au projet, quand
--   l'entité n'est pas déjà renseignée.

UPDATE public.it_budget_lines
SET annee = exercice
WHERE annee IS NULL
  AND exercice IS NOT NULL;

UPDATE public.it_budget_lines AS l
SET entite = c.name
FROM public.it_projects AS p
JOIN public.companies   AS c ON c.id = p.company_id
WHERE l.it_project_id = p.id
  AND (l.entite IS NULL OR l.entite = '')
  AND p.company_id IS NOT NULL;
