-- ============================================================================
-- BE - Calcul cout_rh_budgete depuis be_tjm_fonctions + suppression be_tjm_referentiel
-- ============================================================================
-- Remplace le cout_rh_budgete = 0 par un calcul base sur le taux horaire moyen
-- des fonctions Lucca correspondant a chaque poste BE.
--
-- Mapping BEPoste → moyenne des fonctions Lucca :
--   charge_affaires       → Chargé d'affaire senior, Chargé d'Affaires, Chargé de partenariats
--   ingenieur_etudes      → Ingénieur BE, Ingénieur, Ingénieur d'étude d'exécution,
--                           Ingénieur Automatisme, Ingénieur R&D
--   ingenieur_realisation → Ingénieur réalisation, Ingénieur mise en route
--   projeteur             → Dessinateur Projeteur
--   developpeur           → Ingénieur BE, IT
--   autre                 → moyenne globale de toutes les fonctions
--
-- Formule : cout_rh_budgete = jours * 8h * taux_horaire_moyen_poste
--
-- La table be_tjm_referentiel est ensuite supprimée (plus utilisée dans aucune vue).
-- ============================================================================

-- ── Recréation des vues avec cout_rh_budgete calculé ────────────────────────
DROP VIEW IF EXISTS public.v_be_project_synthese_kpi;
DROP VIEW IF EXISTS public.v_be_project_budget_kpi;
DROP VIEW IF EXISTS public.v_be_affaire_budget_kpi;
DROP VIEW IF EXISTS public.v_be_affaire_temps_kpi;
DROP VIEW IF EXISTS public.v_be_groupe_kpi;

-- CTE réutilisable pour le taux horaire moyen par BEPoste
-- (non extractable comme vue matérialisée dans une fonction, on l'inline dans chaque vue)

CREATE VIEW public.v_be_affaire_temps_kpi AS
WITH taux_par_poste AS (
  SELECT 'charge_affaires'::text AS poste,
    AVG(taux_horaire) AS taux
  FROM public.be_tjm_fonctions
  WHERE fonction IN ('Chargé d''affaire senior', 'Chargé d''Affaires', 'Chargé de partenariats')
  UNION ALL
  SELECT 'ingenieur_etudes',
    AVG(taux_horaire)
  FROM public.be_tjm_fonctions
  WHERE fonction IN ('Ingénieur BE', 'Ingénieur', 'Ingénieur d''étude d''exécution',
                     'Ingénieur Automatisme', 'Ingénieur R&D')
  UNION ALL
  SELECT 'ingenieur_realisation',
    AVG(taux_horaire)
  FROM public.be_tjm_fonctions
  WHERE fonction IN ('Ingénieur réalisation', 'Ingénieur mise en route')
  UNION ALL
  SELECT 'projeteur',
    AVG(taux_horaire)
  FROM public.be_tjm_fonctions
  WHERE fonction = 'Dessinateur Projeteur'
  UNION ALL
  SELECT 'developpeur',
    AVG(taux_horaire)
  FROM public.be_tjm_fonctions
  WHERE fonction IN ('Ingénieur BE', 'IT')
  UNION ALL
  SELECT 'autre',
    AVG(taux_horaire)
  FROM public.be_tjm_fonctions
),
temps_budgete AS (
  SELECT tb.be_affaire_id,
    SUM(tb.jours_budgetes) AS jours_budgetes_total,
    SUM(tb.jours_budgetes * 8.0 * COALESCE(tp.taux, 0)) AS cout_rh_budgete
  FROM public.be_affaire_temps_budget tb
  LEFT JOIN taux_par_poste tp ON tp.poste = tb.poste::text
  GROUP BY tb.be_affaire_id
),
temps_planifie AS (
  SELECT t.be_affaire_id,
    SUM(ws.duration_hours)       AS heures_planifiees,
    SUM(ws.duration_hours / 8.0) AS jours_planifies,
    SUM(ws.duration_hours * COALESCE(fa.taux_horaire, fm.taux_horaire, 0)) AS cout_rh_planifie
  FROM public.tasks t
  JOIN public.workload_slots ws ON ws.task_id = t.id
  LEFT JOIN public.profiles p ON p.id = ws.user_id
  LEFT JOIN public.be_tjm_fonctions fa ON fa.fonction = p.job_title
  LEFT JOIN public.be_tjm_fonctions fm ON fm.fonction = p.be_fonction
  WHERE t.be_affaire_id IS NOT NULL
  GROUP BY t.be_affaire_id
),
temps_declare AS (
  SELECT a.id AS be_affaire_id,
    SUM(t.duree_heures)       AS heures_declarees,
    SUM(t.duree_heures / 8.0) AS jours_declares,
    SUM(t.duree_heures * COALESCE(fa.taux_horaire, fm.taux_horaire, 0)) AS cout_rh_declare
  FROM public.be_affaires a
  JOIN public.lucca_saisie_temps t ON t.code_site = a.code_affaire
  LEFT JOIN public.profiles p ON p.id = t.user_id
  LEFT JOIN public.be_tjm_fonctions fa ON fa.fonction = p.job_title
  LEFT JOIN public.be_tjm_fonctions fm ON fm.fonction = p.be_fonction
  GROUP BY a.id
)
SELECT a.id AS be_affaire_id, a.be_project_id, a.code_affaire,
  COALESCE(tb.jours_budgetes_total, 0) AS jours_budgetes,
  COALESCE(tb.cout_rh_budgete, 0)      AS cout_rh_budgete,
  COALESCE(tp.heures_planifiees, 0)    AS heures_planifiees,
  COALESCE(tp.jours_planifies, 0)      AS jours_planifies,
  COALESCE(tp.cout_rh_planifie, 0)     AS cout_rh_planifie,
  COALESCE(td.heures_declarees, 0)     AS heures_declarees,
  COALESCE(td.jours_declares, 0)       AS jours_declares,
  COALESCE(td.cout_rh_declare, 0)      AS cout_rh_declare
FROM public.be_affaires a
LEFT JOIN temps_budgete  tb ON tb.be_affaire_id = a.id
LEFT JOIN temps_planifie tp ON tp.be_affaire_id = a.id
LEFT JOIN temps_declare  td ON td.be_affaire_id = a.id;

-- ── v_be_groupe_kpi avec cout_rh_budgete calculé ────────────────────────────
CREATE VIEW public.v_be_groupe_kpi AS
WITH taux_par_poste AS (
  SELECT 'charge_affaires'::text AS poste, AVG(taux_horaire) AS taux
  FROM public.be_tjm_fonctions WHERE fonction IN ('Chargé d''affaire senior', 'Chargé d''Affaires', 'Chargé de partenariats')
  UNION ALL
  SELECT 'ingenieur_etudes', AVG(taux_horaire)
  FROM public.be_tjm_fonctions WHERE fonction IN ('Ingénieur BE', 'Ingénieur', 'Ingénieur d''étude d''exécution', 'Ingénieur Automatisme', 'Ingénieur R&D')
  UNION ALL
  SELECT 'ingenieur_realisation', AVG(taux_horaire)
  FROM public.be_tjm_fonctions WHERE fonction IN ('Ingénieur réalisation', 'Ingénieur mise en route')
  UNION ALL
  SELECT 'projeteur', AVG(taux_horaire)
  FROM public.be_tjm_fonctions WHERE fonction = 'Dessinateur Projeteur'
  UNION ALL
  SELECT 'developpeur', AVG(taux_horaire)
  FROM public.be_tjm_fonctions WHERE fonction IN ('Ingénieur BE', 'IT')
  UNION ALL
  SELECT 'autre', AVG(taux_horaire)
  FROM public.be_tjm_fonctions
),
groupes_divalto AS (
  SELECT SUBSTRING(code_affaire, 1, 5) AS code_groupe,
    SUM(CASE WHEN type_mouv = 'CCN' THEN montant_ht END) AS ca_engage,
    SUM(CASE WHEN type_mouv = 'FCN' THEN montant_ht END) AS ca_constate,
    SUM(CASE WHEN type_mouv = 'CFN' THEN montant_ht END) AS cogs_engage,
    SUM(CASE WHEN type_mouv = 'FFN' THEN montant_ht END) AS cogs_constate,
    COUNT(DISTINCT CASE WHEN type_mouv IN ('CCN','CFN') THEN numero_piece END) AS nb_commandes,
    COUNT(DISTINCT CASE WHEN type_mouv IN ('FCN','FFN') THEN numero_piece END) AS nb_factures,
    COUNT(DISTINCT code_affaire) AS nb_activites_divalto
  FROM public.be_divalto_mouvements
  WHERE code_affaire IS NOT NULL AND length(code_affaire) >= 5
  GROUP BY SUBSTRING(code_affaire, 1, 5)
),
groupes_lucca AS (
  SELECT SUBSTRING(t.code_site, 1, 5) AS code_groupe,
    SUM(t.duree_heures)        AS heures_declarees,
    SUM(t.duree_heures / 8.0) AS jours_declares,
    SUM(t.duree_heures * COALESCE(fa.taux_horaire, fm.taux_horaire, 0)) AS cout_rh_declare,
    COUNT(DISTINCT t.id_lucca) AS nb_collaborateurs
  FROM public.lucca_saisie_temps t
  LEFT JOIN public.profiles p ON p.id = t.user_id
  LEFT JOIN public.be_tjm_fonctions fa ON fa.fonction = p.job_title
  LEFT JOIN public.be_tjm_fonctions fm ON fm.fonction = p.be_fonction
  WHERE t.code_site IS NOT NULL AND length(t.code_site) >= 5
  GROUP BY SUBSTRING(t.code_site, 1, 5)
),
groupes_budget AS (
  SELECT SUBSTRING(a.code_affaire, 1, 5) AS code_groupe,
    SUM(b.jours_budgetes) AS jours_budgetes,
    SUM(b.jours_budgetes * 8.0 * COALESCE(tp.taux, 0)) AS cout_rh_budgete
  FROM public.be_affaires a
  JOIN public.be_affaire_temps_budget b ON b.be_affaire_id = a.id
  LEFT JOIN taux_par_poste tp ON tp.poste = b.poste::text
  WHERE a.code_affaire IS NOT NULL AND length(a.code_affaire) >= 5
  GROUP BY SUBSTRING(a.code_affaire, 1, 5)
),
all_groupes AS (
  SELECT code_groupe FROM groupes_divalto
  UNION SELECT code_groupe FROM groupes_lucca
  UNION SELECT code_groupe FROM groupes_budget
),
projet_par_groupe AS (
  SELECT DISTINCT ON (g.code_groupe) g.code_groupe, a.be_project_id
  FROM all_groupes g
  LEFT JOIN public.be_affaires a
    ON a.code_affaire LIKE g.code_groupe || '%'
   AND length(a.code_affaire) >= 5
   AND SUBSTRING(a.code_affaire, 1, 5) = g.code_groupe
  ORDER BY g.code_groupe, length(a.code_affaire)
)
SELECT g.code_groupe, pg.be_project_id,
  COALESCE(d.ca_engage, 0) AS ca_engage_brut,
  COALESCE(d.ca_constate, 0) AS ca_constate_brut,
  COALESCE(d.cogs_engage, 0) AS cogs_engage_brut,
  COALESCE(d.cogs_constate, 0) AS cogs_constate_brut,
  COALESCE(d.ca_constate, 0) - COALESCE(d.cogs_constate, 0) AS marge_constatee_brut,
  COALESCE(d.ca_constate, 0) - COALESCE(d.cogs_constate, 0) AS marge_brute_brut,
  COALESCE(d.ca_constate, 0) - COALESCE(d.cogs_constate, 0) - COALESCE(l.cout_rh_declare, 0) AS marge_directe_brut,
  COALESCE(d.nb_commandes, 0) AS nb_commandes,
  COALESCE(d.nb_factures, 0) AS nb_factures,
  COALESCE(d.nb_activites_divalto, 0) AS nb_activites_divalto,
  COALESCE(b.jours_budgetes, 0) AS jours_budgetes,
  COALESCE(b.cout_rh_budgete, 0) AS cout_rh_budgete,
  COALESCE(l.heures_declarees, 0) AS heures_declarees,
  COALESCE(l.jours_declares, 0) AS jours_declares,
  COALESCE(l.cout_rh_declare, 0) AS cout_rh_declare,
  COALESCE(l.nb_collaborateurs, 0) AS nb_collaborateurs
FROM all_groupes g
LEFT JOIN groupes_divalto d ON d.code_groupe = g.code_groupe
LEFT JOIN groupes_lucca l ON l.code_groupe = g.code_groupe
LEFT JOIN groupes_budget b ON b.code_groupe = g.code_groupe
LEFT JOIN projet_par_groupe pg ON pg.code_groupe = g.code_groupe;

-- ── Vues dépendantes (inchangées) ───────────────────────────────────────────
CREATE VIEW public.v_be_affaire_budget_kpi AS
WITH temps_par_affaire AS (
  SELECT be_affaire_id, jours_declares, cout_rh_declare FROM public.v_be_affaire_temps_kpi
)
SELECT a.id AS be_affaire_id, a.be_project_id, a.code_affaire,
  a.libelle AS affaire_libelle, a.status AS affaire_status,
  COALESCE(SUM(CASE WHEN m.type_mouv = 'CCN' THEN m.montant_ht END), 0) AS ca_engage_brut,
  COALESCE(SUM(CASE WHEN m.type_mouv = 'FCN' THEN m.montant_ht END), 0) AS ca_constate_brut,
  COALESCE(SUM(CASE WHEN m.type_mouv = 'CFN' THEN m.montant_ht END), 0) AS cogs_engage_brut,
  COALESCE(SUM(CASE WHEN m.type_mouv = 'FFN' THEN m.montant_ht END), 0) AS cogs_constate_brut,
  COALESCE(SUM(CASE WHEN m.type_mouv = 'FCN' THEN m.montant_ht END), 0)
    - COALESCE(SUM(CASE WHEN m.type_mouv = 'FFN' THEN m.montant_ht END), 0) AS marge_constatee_brut,
  COALESCE(SUM(CASE WHEN m.type_mouv = 'FCN' THEN m.montant_ht END), 0)
    - COALESCE(SUM(CASE WHEN m.type_mouv = 'FFN' THEN m.montant_ht END), 0) AS marge_brute_brut,
  COALESCE(SUM(CASE WHEN m.type_mouv = 'FCN' THEN m.montant_ht END), 0)
    - COALESCE(SUM(CASE WHEN m.type_mouv = 'FFN' THEN m.montant_ht END), 0)
    - COALESCE(MAX(t.cout_rh_declare), 0) AS marge_directe_brut,
  COALESCE(SUM(CASE WHEN m.type_mouv IN ('CCN','CFN') THEN m.montant_ht END), 0) AS engage_montant_brut,
  COALESCE(SUM(CASE WHEN m.type_mouv IN ('FCN','FFN') THEN m.montant_ht END), 0) AS constate_montant_brut,
  COUNT(DISTINCT CASE WHEN m.type_mouv IN ('CCN','CFN') THEN m.numero_piece END) AS nb_commandes,
  COUNT(DISTINCT CASE WHEN m.type_mouv IN ('FCN','FFN') THEN m.numero_piece END) AS nb_factures,
  COALESCE(MAX(t.jours_declares), 0) AS jours_declares,
  COALESCE(MAX(t.cout_rh_declare), 0) AS cout_rh_declare
FROM public.be_affaires a
LEFT JOIN public.be_divalto_mouvements m ON m.code_affaire = a.code_affaire
LEFT JOIN temps_par_affaire t ON t.be_affaire_id = a.id
GROUP BY a.id, a.be_project_id, a.code_affaire, a.libelle, a.status;

CREATE VIEW public.v_be_project_budget_kpi AS
SELECT p.id AS be_project_id, p.code_projet, COUNT(DISTINCT a.id) AS nb_affaires,
  COALESCE(SUM(k.ca_engage_brut), 0) AS ca_engage_brut,
  COALESCE(SUM(k.ca_constate_brut), 0) AS ca_constate_brut,
  COALESCE(SUM(k.cogs_engage_brut), 0) AS cogs_engage_brut,
  COALESCE(SUM(k.cogs_constate_brut), 0) AS cogs_constate_brut,
  COALESCE(SUM(k.marge_constatee_brut), 0) AS marge_constatee_brut,
  COALESCE(SUM(k.marge_brute_brut), 0) AS marge_brute_brut,
  COALESCE(SUM(k.marge_directe_brut), 0) AS marge_directe_brut,
  COALESCE(SUM(k.engage_montant_brut), 0) AS engage_montant_brut,
  COALESCE(SUM(k.constate_montant_brut), 0) AS constate_montant_brut,
  COALESCE(SUM(k.nb_commandes), 0) AS nb_commandes,
  COALESCE(SUM(k.nb_factures), 0) AS nb_factures
FROM public.be_projects p
LEFT JOIN public.be_affaires a ON a.be_project_id = p.id
LEFT JOIN public.v_be_affaire_budget_kpi k ON k.be_affaire_id = a.id
GROUP BY p.id, p.code_projet;

CREATE VIEW public.v_be_project_synthese_kpi AS
SELECT p.id AS be_project_id, p.code_projet, p.nom_projet, p.status,
  COUNT(DISTINCT a.id) AS nb_affaires,
  COALESCE(SUM(b.ca_engage_brut), 0) AS ca_engage_brut,
  COALESCE(SUM(b.ca_constate_brut), 0) AS ca_constate_brut,
  COALESCE(SUM(b.cogs_engage_brut), 0) AS cogs_engage_brut,
  COALESCE(SUM(b.cogs_constate_brut), 0) AS cogs_constate_brut,
  COALESCE(SUM(b.marge_constatee_brut), 0) AS marge_constatee_brut,
  COALESCE(SUM(b.marge_brute_brut), 0) AS marge_brute_brut,
  COALESCE(SUM(b.marge_directe_brut), 0) AS marge_directe_brut,
  COALESCE(SUM(b.nb_commandes), 0) AS nb_commandes,
  COALESCE(SUM(b.nb_factures), 0) AS nb_factures,
  COALESCE(SUM(t.jours_budgetes), 0) AS jours_budgetes,
  COALESCE(SUM(t.cout_rh_budgete), 0) AS cout_rh_budgete,
  COALESCE(SUM(t.jours_planifies), 0) AS jours_planifies,
  COALESCE(SUM(t.cout_rh_planifie), 0) AS cout_rh_planifie,
  COALESCE(SUM(t.jours_declares), 0) AS jours_declares,
  COALESCE(SUM(t.cout_rh_declare), 0) AS cout_rh_declare
FROM public.be_projects p
LEFT JOIN public.be_affaires a ON a.be_project_id = p.id
LEFT JOIN public.v_be_affaire_budget_kpi b ON b.be_affaire_id = a.id
LEFT JOIN public.v_be_affaire_temps_kpi t ON t.be_affaire_id = a.id
GROUP BY p.id, p.code_projet, p.nom_projet, p.status;

-- ── Recréation de v_be_temps_detail_mensuel (supprime dép. sur be_tjm_referentiel) ─
DROP VIEW IF EXISTS public.v_be_temps_detail_mensuel;

CREATE VIEW public.v_be_temps_detail_mensuel AS
WITH taux_par_poste AS (
  SELECT 'charge_affaires'::text AS poste, AVG(taux_horaire) AS taux
  FROM public.be_tjm_fonctions WHERE fonction IN ('Chargé d''affaire senior', 'Chargé d''Affaires', 'Chargé de partenariats')
  UNION ALL
  SELECT 'ingenieur_etudes', AVG(taux_horaire)
  FROM public.be_tjm_fonctions WHERE fonction IN ('Ingénieur BE', 'Ingénieur', 'Ingénieur d''étude d''exécution', 'Ingénieur Automatisme', 'Ingénieur R&D')
  UNION ALL
  SELECT 'ingenieur_realisation', AVG(taux_horaire)
  FROM public.be_tjm_fonctions WHERE fonction IN ('Ingénieur réalisation', 'Ingénieur mise en route')
  UNION ALL
  SELECT 'projeteur', AVG(taux_horaire)
  FROM public.be_tjm_fonctions WHERE fonction = 'Dessinateur Projeteur'
  UNION ALL
  SELECT 'developpeur', AVG(taux_horaire)
  FROM public.be_tjm_fonctions WHERE fonction IN ('Ingénieur BE', 'IT')
  UNION ALL
  SELECT 'autre', AVG(taux_horaire)
  FROM public.be_tjm_fonctions
)
SELECT
  date_trunc('month', t.date_saisie::timestamp with time zone)::date AS mois,
  t.code_site AS code_affaire,
  a.id AS be_affaire_id,
  a.libelle AS affaire_libelle,
  a.be_project_id,
  t.user_id,
  p.display_name AS user_display_name,
  COALESCE(p.be_poste, 'autre'::text) AS poste,
  SUM(t.duree_heures) AS heures,
  SUM(t.duree_heures / 8.0) AS jours,
  SUM(t.duree_heures * COALESCE(tp.taux, 0::numeric)) AS cout_rh,
  COUNT(*) AS nb_saisies
FROM public.lucca_saisie_temps t
LEFT JOIN public.be_affaires a ON a.code_affaire = t.code_site
LEFT JOIN public.profiles p ON p.id = t.user_id
LEFT JOIN taux_par_poste tp ON tp.poste = COALESCE(p.be_poste, 'autre'::text)
GROUP BY
  date_trunc('month', t.date_saisie::timestamp with time zone)::date,
  t.code_site, a.id, a.libelle, a.be_project_id,
  t.user_id, p.display_name,
  COALESCE(p.be_poste, 'autre'::text);

-- ── Suppression de be_tjm_referentiel ───────────────────────────────────────
-- La table n'est plus referencee par aucune vue ni FK.
-- Les TJM par poste sont desormais derives de be_tjm_fonctions (taux moyen par categorie).
DROP TABLE IF EXISTS public.be_tjm_referentiel;
