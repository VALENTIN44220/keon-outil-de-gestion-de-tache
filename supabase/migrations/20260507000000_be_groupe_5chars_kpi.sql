-- ============================================================================
-- BE - Niveau de regroupement "affaire globale" (5 chars)
-- ============================================================================
-- Le code Divalto/Lucca a 8 chars (ex: 'EVINZETD') represente une activite.
-- Les 5 premiers chars (ex: 'EVINZ') regroupent toutes les activites d'une
-- meme affaire globale. Cette migration ajoute une vue qui agrege les KPIs
-- (CA / COGS / Marge / Jours / Cout RH) par projet x prefixe 5 chars,
-- en scannant directement les sources brutes (be_divalto_mouvements +
-- lucca_saisie_temps + be_affaire_temps_budget). Pas de dependance aux
-- entrees de be_affaires - donc aucun risque de double-comptage si l'user
-- a cree des affaires aux deux niveaux.
--
-- Rattachement projet :
-- - Pour les data Divalto / Lucca, le projet est deduit en cherchant une
--   be_affaire dont code_affaire = code_5chars OR code_affaire LIKE code_5chars||'%'
--   et en prenant son be_project_id. Si aucune be_affaire ne match, be_project_id
--   est NULL (groupe orphelin, pas rattache a un projet).
-- ============================================================================

CREATE OR REPLACE VIEW public.v_be_groupe_kpi AS
WITH groupes_divalto AS (
  -- Tous les codes 5 chars distincts vus dans be_divalto_mouvements
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
  -- Tous les codes 5 chars distincts vus dans lucca_saisie_temps
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
  -- Saisies de budget temps (par affaire BE) regroupees au niveau 5 chars
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
  -- Union de tous les codes_groupe vus, qu'ils aient une be_affaire ou pas
  SELECT code_groupe FROM groupes_divalto
  UNION
  SELECT code_groupe FROM groupes_lucca
  UNION
  SELECT code_groupe FROM groupes_budget
),
projet_par_groupe AS (
  -- Rattachement au projet BE : on cherche une be_affaire dont code_affaire
  -- match exactement le code_groupe (5 chars) OU commence par lui (8 chars).
  -- On prend be_project_id de la 1re affaire trouvee (DISTINCT ON sur code_groupe).
  SELECT DISTINCT ON (g.code_groupe)
    g.code_groupe,
    a.be_project_id
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
  -- CA / COGS Divalto
  COALESCE(d.ca_engage,      0) AS ca_engage_brut,
  COALESCE(d.ca_constate,    0) AS ca_constate_brut,
  COALESCE(d.cogs_engage,    0) AS cogs_engage_brut,
  COALESCE(d.cogs_constate,  0) AS cogs_constate_brut,
  COALESCE(d.ca_constate,    0) - COALESCE(d.cogs_constate, 0) AS marge_constatee_brut,
  COALESCE(d.nb_commandes,        0) AS nb_commandes,
  COALESCE(d.nb_factures,         0) AS nb_factures,
  COALESCE(d.nb_activites_divalto, 0) AS nb_activites_divalto,
  -- Temps
  COALESCE(b.jours_budgetes,      0) AS jours_budgetes,
  COALESCE(b.cout_rh_budgete,     0) AS cout_rh_budgete,
  COALESCE(l.heures_declarees,    0) AS heures_declarees,
  COALESCE(l.jours_declares,      0) AS jours_declares,
  COALESCE(l.cout_rh_declare,     0) AS cout_rh_declare,
  COALESCE(l.nb_collaborateurs,   0) AS nb_collaborateurs
FROM all_groupes g
LEFT JOIN groupes_divalto    d  ON d.code_groupe  = g.code_groupe
LEFT JOIN groupes_lucca      l  ON l.code_groupe  = g.code_groupe
LEFT JOIN groupes_budget     b  ON b.code_groupe  = g.code_groupe
LEFT JOIN projet_par_groupe  pg ON pg.code_groupe = g.code_groupe;

COMMENT ON VIEW public.v_be_groupe_kpi IS
  'KPI agreges par "affaire globale" (prefixe 5 chars du code_affaire). Scanne directement be_divalto_mouvements, lucca_saisie_temps et be_affaire_temps_budget pour calculer les totaux sans dependre des entrees be_affaires. Le rattachement projet (be_project_id) est deduit de la 1re be_affaire correspondante, NULL si aucune.';
