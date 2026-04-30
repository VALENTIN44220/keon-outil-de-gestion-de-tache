-- ============================================================================
-- BE - Marge brute / Marge sur couts directs
-- ============================================================================
-- Ajoute aux vues KPI :
--   - marge_brute_brut    = marge_constatee_brut (alias semantique)
--   - marge_directe_brut  = marge_brute - cout_rh_declare (Lucca x TJM)
--   - cout_rh_declare et jours_declares portes au niveau affaire
--
-- Refait les vues v_be_affaire_budget_kpi, v_be_project_budget_kpi,
-- v_be_groupe_kpi pour exposer ces nouveaux champs.
-- ============================================================================

DROP VIEW IF EXISTS public.v_be_project_synthese_kpi;
DROP VIEW IF EXISTS public.v_be_project_budget_kpi;
DROP VIEW IF EXISTS public.v_be_groupe_kpi;
DROP VIEW IF EXISTS public.v_be_affaire_budget_kpi;

CREATE VIEW public.v_be_affaire_budget_kpi AS
WITH temps_par_affaire AS (
  SELECT be_affaire_id, jours_declares, cout_rh_declare
  FROM public.v_be_affaire_temps_kpi
)
SELECT
  a.id              AS be_affaire_id,
  a.be_project_id,
  a.code_affaire,
  a.libelle         AS affaire_libelle,
  a.status          AS affaire_status,
  COALESCE(SUM(CASE WHEN m.type_mouv = 'CCN' THEN m.montant_ht END), 0) AS ca_engage_brut,
  COALESCE(SUM(CASE WHEN m.type_mouv = 'FCN' THEN m.montant_ht END), 0) AS ca_constate_brut,
  COALESCE(SUM(CASE WHEN m.type_mouv = 'CFN' THEN m.montant_ht END), 0) AS cogs_engage_brut,
  COALESCE(SUM(CASE WHEN m.type_mouv = 'FFN' THEN m.montant_ht END), 0) AS cogs_constate_brut,
  COALESCE(SUM(CASE WHEN m.type_mouv = 'FCN' THEN m.montant_ht END), 0)
    - COALESCE(SUM(CASE WHEN m.type_mouv = 'FFN' THEN m.montant_ht END), 0)
    AS marge_constatee_brut,
  COALESCE(SUM(CASE WHEN m.type_mouv = 'FCN' THEN m.montant_ht END), 0)
    - COALESCE(SUM(CASE WHEN m.type_mouv = 'FFN' THEN m.montant_ht END), 0)
    AS marge_brute_brut,
  COALESCE(SUM(CASE WHEN m.type_mouv = 'FCN' THEN m.montant_ht END), 0)
    - COALESCE(SUM(CASE WHEN m.type_mouv = 'FFN' THEN m.montant_ht END), 0)
    - COALESCE(MAX(t.cout_rh_declare), 0)
    AS marge_directe_brut,
  COALESCE(SUM(CASE WHEN m.type_mouv IN ('CCN','CFN') THEN m.montant_ht END), 0) AS engage_montant_brut,
  COALESCE(SUM(CASE WHEN m.type_mouv IN ('FCN','FFN') THEN m.montant_ht END), 0) AS constate_montant_brut,
  COUNT(DISTINCT CASE WHEN m.type_mouv IN ('CCN','CFN') THEN m.numero_piece END) AS nb_commandes,
  COUNT(DISTINCT CASE WHEN m.type_mouv IN ('FCN','FFN') THEN m.numero_piece END) AS nb_factures,
  COALESCE(MAX(t.jours_declares), 0)   AS jours_declares,
  COALESCE(MAX(t.cout_rh_declare), 0)  AS cout_rh_declare
FROM public.be_affaires a
LEFT JOIN public.be_divalto_mouvements m ON m.code_affaire = a.code_affaire
LEFT JOIN temps_par_affaire t            ON t.be_affaire_id = a.id
GROUP BY a.id, a.be_project_id, a.code_affaire, a.libelle, a.status;

CREATE VIEW public.v_be_project_budget_kpi AS
SELECT
  p.id           AS be_project_id,
  p.code_projet,
  COUNT(DISTINCT a.id) AS nb_affaires,
  COALESCE(SUM(k.ca_engage_brut),     0) AS ca_engage_brut,
  COALESCE(SUM(k.ca_constate_brut),   0) AS ca_constate_brut,
  COALESCE(SUM(k.cogs_engage_brut),   0) AS cogs_engage_brut,
  COALESCE(SUM(k.cogs_constate_brut), 0) AS cogs_constate_brut,
  COALESCE(SUM(k.marge_constatee_brut), 0) AS marge_constatee_brut,
  COALESCE(SUM(k.marge_brute_brut), 0)   AS marge_brute_brut,
  COALESCE(SUM(k.marge_directe_brut), 0) AS marge_directe_brut,
  COALESCE(SUM(k.engage_montant_brut),  0) AS engage_montant_brut,
  COALESCE(SUM(k.constate_montant_brut), 0) AS constate_montant_brut,
  COALESCE(SUM(k.nb_commandes),  0) AS nb_commandes,
  COALESCE(SUM(k.nb_factures),   0) AS nb_factures
FROM public.be_projects p
LEFT JOIN public.be_affaires a            ON a.be_project_id = p.id
LEFT JOIN public.v_be_affaire_budget_kpi k ON k.be_affaire_id = a.id
GROUP BY p.id, p.code_projet;

CREATE VIEW public.v_be_project_synthese_kpi AS
SELECT
  p.id                                     AS be_project_id,
  p.code_projet,
  p.nom_projet,
  p.status,
  COUNT(DISTINCT a.id)                     AS nb_affaires,
  COALESCE(SUM(b.ca_engage_brut), 0)       AS ca_engage_brut,
  COALESCE(SUM(b.ca_constate_brut), 0)     AS ca_constate_brut,
  COALESCE(SUM(b.cogs_engage_brut), 0)     AS cogs_engage_brut,
  COALESCE(SUM(b.cogs_constate_brut), 0)   AS cogs_constate_brut,
  COALESCE(SUM(b.marge_constatee_brut), 0) AS marge_constatee_brut,
  COALESCE(SUM(b.marge_brute_brut), 0)     AS marge_brute_brut,
  COALESCE(SUM(b.marge_directe_brut), 0)   AS marge_directe_brut,
  COALESCE(SUM(b.nb_commandes), 0)         AS nb_commandes,
  COALESCE(SUM(b.nb_factures), 0)          AS nb_factures,
  COALESCE(SUM(t.jours_budgetes), 0)       AS jours_budgetes,
  COALESCE(SUM(t.cout_rh_budgete), 0)      AS cout_rh_budgete,
  COALESCE(SUM(t.jours_planifies), 0)      AS jours_planifies,
  COALESCE(SUM(t.cout_rh_planifie), 0)     AS cout_rh_planifie,
  COALESCE(SUM(t.jours_declares), 0)       AS jours_declares,
  COALESCE(SUM(t.cout_rh_declare), 0)      AS cout_rh_declare
FROM public.be_projects p
LEFT JOIN public.be_affaires a            ON a.be_project_id = p.id
LEFT JOIN public.v_be_affaire_budget_kpi b ON b.be_affaire_id = a.id
LEFT JOIN public.v_be_affaire_temps_kpi t  ON t.be_affaire_id = a.id
GROUP BY p.id, p.code_projet, p.nom_projet, p.status;

CREATE VIEW public.v_be_groupe_kpi AS
WITH groupes_divalto AS (
  SELECT
    SUBSTRING(code_affaire, 1, 5) AS code_groupe,
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
  SELECT
    SUBSTRING(code_site, 1, 5) AS code_groupe,
    SUM(duree_heures) AS heures_declarees,
    SUM(duree_heures / 8.0) AS jours_declares,
    SUM(duree_heures / 8.0 * COALESCE(tjm.tjm, 0)) AS cout_rh_declare,
    COUNT(DISTINCT t.id_lucca) AS nb_collaborateurs
  FROM public.lucca_saisie_temps t
  LEFT JOIN public.profiles p ON p.id = t.user_id
  LEFT JOIN public.be_tjm_referentiel tjm ON tjm.poste = p.be_poste
  WHERE t.code_site IS NOT NULL AND length(t.code_site) >= 5
  GROUP BY SUBSTRING(t.code_site, 1, 5)
),
groupes_budget AS (
  SELECT
    SUBSTRING(a.code_affaire, 1, 5) AS code_groupe,
    SUM(b.jours_budgetes) AS jours_budgetes,
    SUM(b.jours_budgetes * COALESCE(tjm.tjm, 0)) AS cout_rh_budgete
  FROM public.be_affaires a
  JOIN public.be_affaire_temps_budget b ON b.be_affaire_id = a.id
  LEFT JOIN public.be_tjm_referentiel tjm ON tjm.poste = b.poste
  WHERE a.code_affaire IS NOT NULL AND length(a.code_affaire) >= 5
  GROUP BY SUBSTRING(a.code_affaire, 1, 5)
),
all_groupes AS (
  SELECT code_groupe FROM groupes_divalto
  UNION SELECT code_groupe FROM groupes_lucca
  UNION SELECT code_groupe FROM groupes_budget
),
projet_par_groupe AS (
  SELECT DISTINCT ON (g.code_groupe)
    g.code_groupe, a.be_project_id
  FROM all_groupes g
  LEFT JOIN public.be_affaires a
    ON a.code_affaire LIKE g.code_groupe || '%'
   AND length(a.code_affaire) >= 5
   AND SUBSTRING(a.code_affaire, 1, 5) = g.code_groupe
  ORDER BY g.code_groupe, length(a.code_affaire)
)
SELECT
  g.code_groupe,
  pg.be_project_id,
  COALESCE(d.ca_engage,      0) AS ca_engage_brut,
  COALESCE(d.ca_constate,    0) AS ca_constate_brut,
  COALESCE(d.cogs_engage,    0) AS cogs_engage_brut,
  COALESCE(d.cogs_constate,  0) AS cogs_constate_brut,
  COALESCE(d.ca_constate, 0) - COALESCE(d.cogs_constate, 0) AS marge_constatee_brut,
  COALESCE(d.ca_constate, 0) - COALESCE(d.cogs_constate, 0) AS marge_brute_brut,
  COALESCE(d.ca_constate, 0) - COALESCE(d.cogs_constate, 0) - COALESCE(l.cout_rh_declare, 0) AS marge_directe_brut,
  COALESCE(d.nb_commandes, 0) AS nb_commandes,
  COALESCE(d.nb_factures,  0) AS nb_factures,
  COALESCE(d.nb_activites_divalto, 0) AS nb_activites_divalto,
  COALESCE(b.jours_budgetes,    0) AS jours_budgetes,
  COALESCE(b.cout_rh_budgete,   0) AS cout_rh_budgete,
  COALESCE(l.heures_declarees,  0) AS heures_declarees,
  COALESCE(l.jours_declares,    0) AS jours_declares,
  COALESCE(l.cout_rh_declare,   0) AS cout_rh_declare,
  COALESCE(l.nb_collaborateurs, 0) AS nb_collaborateurs
FROM all_groupes g
LEFT JOIN groupes_divalto    d  ON d.code_groupe  = g.code_groupe
LEFT JOIN groupes_lucca      l  ON l.code_groupe  = g.code_groupe
LEFT JOIN groupes_budget     b  ON b.code_groupe  = g.code_groupe
LEFT JOIN projet_par_groupe  pg ON pg.code_groupe = g.code_groupe;
