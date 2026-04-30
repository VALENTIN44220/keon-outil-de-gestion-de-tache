-- ============================================================================
-- BE Temps & RH - Vues de detail par collaborateur et par poste
-- ============================================================================
-- Permet d'afficher dans l'UI la repartition du temps declare et du cout RH
-- par collaborateur (qui a passe combien de temps) et par poste (charge_aff,
-- ing_etudes, ...) sur une affaire donnee.
--
-- Ces vues completent v_be_affaire_temps_kpi qui ne fournit que des totaux.
-- ============================================================================

-- 1. Detail par collaborateur (1 ligne par couple affaire x user)
CREATE OR REPLACE VIEW public.v_be_affaire_temps_par_user AS
SELECT
  a.id                    AS be_affaire_id,
  a.code_affaire,
  l.user_id,
  l.id_lucca,
  p.display_name,
  p.be_poste,
  COUNT(*)                                                    AS nb_saisies,
  SUM(l.duree_heures)                                         AS heures,
  SUM(l.duree_heures / 8.0)                                   AS jours,
  SUM(l.duree_heures / 8.0 * COALESCE(tjm.tjm, 0))           AS cout_rh,
  MIN(l.date_saisie)                                          AS premiere_saisie,
  MAX(l.date_saisie)                                          AS derniere_saisie
FROM public.be_affaires a
JOIN public.lucca_saisie_temps l ON l.code_site = a.code_affaire
LEFT JOIN public.profiles p ON p.id = l.user_id
LEFT JOIN public.be_tjm_referentiel tjm ON tjm.poste = p.be_poste
GROUP BY a.id, a.code_affaire, l.user_id, l.id_lucca, p.display_name, p.be_poste;

COMMENT ON VIEW public.v_be_affaire_temps_par_user IS
  'Detail du temps declare par collaborateur sur une affaire BE. 1 ligne par couple affaire x user, avec heures / jours / cout RH (TJM par poste).';

-- 2. Detail par poste (1 ligne par couple affaire x poste)
CREATE OR REPLACE VIEW public.v_be_affaire_temps_par_poste AS
SELECT
  a.id                                          AS be_affaire_id,
  a.code_affaire,
  COALESCE(p.be_poste, 'non_assigne')           AS poste,
  COUNT(DISTINCT l.user_id)                     AS nb_collaborateurs,
  COUNT(*)                                      AS nb_saisies,
  SUM(l.duree_heures)                           AS heures,
  SUM(l.duree_heures / 8.0)                     AS jours,
  SUM(l.duree_heures / 8.0 * COALESCE(tjm.tjm, 0)) AS cout_rh
FROM public.be_affaires a
JOIN public.lucca_saisie_temps l ON l.code_site = a.code_affaire
LEFT JOIN public.profiles p ON p.id = l.user_id
LEFT JOIN public.be_tjm_referentiel tjm ON tjm.poste = p.be_poste
GROUP BY a.id, a.code_affaire, COALESCE(p.be_poste, 'non_assigne');

COMMENT ON VIEW public.v_be_affaire_temps_par_poste IS
  'Detail du temps declare par poste BE sur une affaire. ''non_assigne'' regroupe les collaborateurs Lucca dont le profil n''a pas de be_poste.';
