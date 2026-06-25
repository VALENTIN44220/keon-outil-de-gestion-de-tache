-- Vue d'aide : liste des codes d'imputation Lucca avec volume déclaré.
-- Sert au sélecteur du rapprochement RH (Mode A) côté IT.
CREATE OR REPLACE VIEW public.v_lucca_code_sites AS
SELECT
  code_site,
  COUNT(*)                  AS nb_saisies,
  SUM(duree_heures) / 8.0   AS jours,
  MIN(date_saisie)          AS premiere,
  MAX(date_saisie)          AS derniere
FROM public.lucca_saisie_temps
WHERE code_site IS NOT NULL
GROUP BY code_site;

GRANT SELECT ON public.v_lucca_code_sites TO authenticated;
