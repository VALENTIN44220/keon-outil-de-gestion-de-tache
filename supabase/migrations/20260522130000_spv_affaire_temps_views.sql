-- Suivi des temps SPV : affaires dont le code commence par 'M'.
-- Contrairement au BE (restreint à un service), TOUS les salariés du groupe
-- peuvent imputer sur les affaires M. La valorisation réutilise be_tjm_fonctions
-- joint sur profiles.job_title / be_fonction (taux applicable à tout le monde).

-- KPI agrégé par affaire M
CREATE OR REPLACE VIEW public.v_spv_affaire_temps_kpi AS
SELECT
  t.code_site AS code_affaire,
  SUM(t.duree_heures)                                                            AS heures_declarees,
  SUM(t.duree_heures / 8.0)                                                      AS jours_declares,
  SUM(t.duree_heures * COALESCE(fa.taux_horaire, fm.taux_horaire, 0::numeric))   AS cout_rh_declare,
  COUNT(DISTINCT t.user_id)                                                      AS nb_collaborateurs,
  MIN(t.date_saisie)                                                             AS premiere_saisie,
  MAX(t.date_saisie)                                                             AS derniere_saisie
FROM public.lucca_saisie_temps t
LEFT JOIN public.profiles p        ON p.id = t.user_id
LEFT JOIN public.be_tjm_fonctions fa ON fa.fonction = p.job_title
LEFT JOIN public.be_tjm_fonctions fm ON fm.fonction = p.be_fonction
WHERE t.code_site ILIKE 'M%'
GROUP BY t.code_site;

-- Détail par collaborateur pour une affaire M
CREATE OR REPLACE VIEW public.v_spv_affaire_temps_par_user AS
SELECT
  t.code_site AS code_affaire,
  t.user_id,
  p.display_name,
  p.job_title,
  COALESCE(fa.taux_horaire, fm.taux_horaire, 0::numeric)                         AS taux_horaire,
  SUM(t.duree_heures)                                                            AS heures,
  SUM(t.duree_heures / 8.0)                                                      AS jours,
  SUM(t.duree_heures * COALESCE(fa.taux_horaire, fm.taux_horaire, 0::numeric))   AS cout_rh
FROM public.lucca_saisie_temps t
LEFT JOIN public.profiles p        ON p.id = t.user_id
LEFT JOIN public.be_tjm_fonctions fa ON fa.fonction = p.job_title
LEFT JOIN public.be_tjm_fonctions fm ON fm.fonction = p.be_fonction
WHERE t.code_site ILIKE 'M%'
GROUP BY t.code_site, t.user_id, p.display_name, p.job_title, fa.taux_horaire, fm.taux_horaire;
