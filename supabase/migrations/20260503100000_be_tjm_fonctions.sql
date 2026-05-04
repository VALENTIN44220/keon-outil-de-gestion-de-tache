-- ============================================================================
-- BE - Referentiel TJM par FONCTION Lucca (taux horaire reel)
-- ============================================================================
-- Cree une table be_tjm_fonctions qui stocke le taux horaire (€/h) par
-- fonction Lucca (job_title du profil). Ces taux sont issus des salaires
-- moyens horaires reel par poste.
--
-- Formule de cout RH :
--   cout_rh = heures * COALESCE(fn.taux_horaire, tjm.tjm / 8.0, 0)
--
-- Priorite : be_tjm_fonctions (via profiles.job_title) > be_tjm_referentiel
-- (via profiles.be_poste, converti en €/h par division par 8).
--
-- Met a jour toutes les vues qui calculent cout_rh a partir de Lucca :
--   v_be_affaire_temps_kpi
--   v_be_affaire_temps_par_user
--   v_be_affaire_temps_par_poste
--   v_be_groupe_kpi
-- Puis recrée les vues dépendantes inchangées :
--   v_be_affaire_budget_kpi
--   v_be_project_budget_kpi
--   v_be_project_synthese_kpi
-- ============================================================================

-- 1. Table be_tjm_fonctions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.be_tjm_fonctions (
  fonction      TEXT          PRIMARY KEY,
  taux_horaire  NUMERIC(10,4) NOT NULL CHECK (taux_horaire >= 0),
  description   TEXT,
  updated_by    UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.be_tjm_fonctions IS
  'Taux horaire (€/h) par fonction Lucca (profiles.job_title). '
  'Utilise en priorite sur be_tjm_referentiel pour valoriser les heures declarees. '
  'Source : salaires moyens horaires réels par poste (données RH).';

CREATE TRIGGER update_be_tjm_fonctions_updated_at
  BEFORE UPDATE ON public.be_tjm_fonctions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.be_tjm_fonctions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read be_tjm_fonctions"
  ON public.be_tjm_fonctions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert be_tjm_fonctions"
  ON public.be_tjm_fonctions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update be_tjm_fonctions"
  ON public.be_tjm_fonctions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete be_tjm_fonctions"
  ON public.be_tjm_fonctions FOR DELETE TO authenticated USING (true);

-- 2. Données initiales (33 fonctions, salaires moyens horaires réels)
-- ============================================================================
INSERT INTO public.be_tjm_fonctions (fonction, taux_horaire, description) VALUES
  ('Apprenti',                        193.98, 'Salaire moyen horaire - Apprenti'),
  ('Assistante',                        33.35, 'Salaire moyen horaire - Assistante'),
  ('Assistante commerciale',            33.11, 'Salaire moyen horaire - Assistante commerciale'),
  ('Chargé d''affaire senior',         153.07, 'Salaire moyen horaire - Chargé d''affaire senior'),
  ('Chargé d''Affaires',              416.79, 'Salaire moyen horaire - Chargé d''Affaires'),
  ('Chargé de partenariats',          241.38, 'Salaire moyen horaire - Chargé de partenariats'),
  ('Chef de projet junior',           260.76, 'Salaire moyen horaire - Chef de projet junior'),
  ('Chef de projet senior',           262.38, 'Salaire moyen horaire - Chef de projet senior'),
  ('CODIR',                           927.34, 'Salaire moyen horaire - CODIR'),
  ('Conducteur de travaux',            84.86, 'Salaire moyen horaire - Conducteur de travaux'),
  ('Dessinateur Projeteur',           109.56, 'Salaire moyen horaire - Dessinateur Projeteur'),
  ('Finance',                         227.92, 'Salaire moyen horaire - Finance'),
  ('Fonction support',                127.55, 'Salaire moyen horaire - Fonction support'),
  ('Ingénieur',                        86.48, 'Salaire moyen horaire - Ingénieur'),
  ('Ingénieur Automatisme',            66.78, 'Salaire moyen horaire - Ingénieur Automatisme'),
  ('Ingénieur BE',                    233.57, 'Salaire moyen horaire - Ingénieur BE'),
  ('Ingénieur d''étude d''exécution', 162.88, 'Salaire moyen horaire - Ingénieur d''étude d''exécution'),
  ('Ingénieur mise en route',         121.98, 'Salaire moyen horaire - Ingénieur mise en route'),
  ('Ingénieur R&D',                    87.08, 'Salaire moyen horaire - Ingénieur R&D'),
  ('Ingénieur réalisation',           170.51, 'Salaire moyen horaire - Ingénieur réalisation'),
  ('IT',                               76.10, 'Salaire moyen horaire - IT'),
  ('Manager',                         262.05, 'Salaire moyen horaire - Manager'),
  ('MKT',                             106.07, 'Salaire moyen horaire - MKT'),
  ('Responsable',                    1181.22, 'Salaire moyen horaire - Responsable'),
  ('Responsable régional',            214.12, 'Salaire moyen horaire - Responsable régional'),
  ('Responsable technique',           159.85, 'Salaire moyen horaire - Responsable technique'),
  ('RH',                              147.26, 'Salaire moyen horaire - RH'),
  ('Services partagés',                95.85, 'Salaire moyen horaire - Services partagés'),
  ('Support',                          77.84, 'Salaire moyen horaire - Support'),
  ('Technicien',                      203.34, 'Salaire moyen horaire - Technicien'),
  ('Technicien spécialisé',            26.13, 'Salaire moyen horaire - Technicien spécialisé'),
  ('Technico-commercial',              45.06, 'Salaire moyen horaire - Technico-commercial'),
  ('VIE',                              20.65, 'Salaire moyen horaire - VIE')
ON CONFLICT (fonction) DO UPDATE
  SET taux_horaire = EXCLUDED.taux_horaire,
      description  = EXCLUDED.description,
      updated_at   = now();

-- 3. Mise à jour des vues (DROP dans l'ordre inverse des dépendances)
-- ============================================================================
DROP VIEW IF EXISTS public.v_be_project_synthese_kpi;
DROP VIEW IF EXISTS public.v_be_project_budget_kpi;
DROP VIEW IF EXISTS public.v_be_affaire_budget_kpi;
DROP VIEW IF EXISTS public.v_be_affaire_temps_kpi;
DROP VIEW IF EXISTS public.v_be_affaire_temps_par_user;
DROP VIEW IF EXISTS public.v_be_affaire_temps_par_poste;
DROP VIEW IF EXISTS public.v_be_groupe_kpi;

-- 3a. v_be_affaire_temps_kpi (avec taux horaire par fonction en priorité)
-- ============================================================================
CREATE VIEW public.v_be_affaire_temps_kpi AS
WITH temps_budgete AS (
  -- Budget temps par poste (valorisé au TJM du poste, converti en €/h)
  SELECT
    tb.be_affaire_id,
    SUM(tb.jours_budgetes)                                              AS jours_budgetes_total,
    SUM(tb.jours_budgetes * COALESCE(tjm.tjm, 0))                      AS cout_rh_budgete
  FROM public.be_affaire_temps_budget tb
  LEFT JOIN public.be_tjm_referentiel tjm ON tjm.poste = tb.poste
  GROUP BY tb.be_affaire_id
),
temps_planifie AS (
  -- Temps planifié (workload_slots) : priorité taux_horaire fonction > TJM poste/8
  SELECT
    t.be_affaire_id,
    SUM(ws.duration_hours)                                              AS heures_planifiees,
    SUM(ws.duration_hours / 8.0)                                        AS jours_planifies,
    SUM(ws.duration_hours
        * COALESCE(fn.taux_horaire, tjm.tjm / 8.0, 0))                 AS cout_rh_planifie
  FROM public.tasks t
  JOIN public.workload_slots ws ON ws.task_id = t.id
  LEFT JOIN public.profiles p   ON p.id = ws.user_id
  LEFT JOIN public.be_tjm_fonctions     fn  ON fn.fonction  = p.job_title
  LEFT JOIN public.be_tjm_referentiel   tjm ON tjm.poste    = p.be_poste
  WHERE t.be_affaire_id IS NOT NULL
  GROUP BY t.be_affaire_id
),
temps_declare AS (
  -- Temps déclaré Lucca : priorité taux_horaire fonction > TJM poste/8
  SELECT
    a.id AS be_affaire_id,
    SUM(t.duree_heures)                                                 AS heures_declarees,
    SUM(t.duree_heures / 8.0)                                           AS jours_declares,
    SUM(t.duree_heures
        * COALESCE(fn.taux_horaire, tjm.tjm / 8.0, 0))                 AS cout_rh_declare
  FROM public.be_affaires a
  JOIN public.lucca_saisie_temps t ON t.code_site = a.code_affaire
  LEFT JOIN public.profiles p       ON p.id = t.user_id
  LEFT JOIN public.be_tjm_fonctions   fn  ON fn.fonction = p.job_title
  LEFT JOIN public.be_tjm_referentiel tjm ON tjm.poste   = p.be_poste
  GROUP BY a.id
)
SELECT
  a.id           AS be_affaire_id,
  a.be_project_id,
  a.code_affaire,
  COALESCE(tb.jours_budgetes_total, 0) AS jours_budgetes,
  COALESCE(tb.cout_rh_budgete,      0) AS cout_rh_budgete,
  COALESCE(tp.heures_planifiees,    0) AS heures_planifiees,
  COALESCE(tp.jours_planifies,      0) AS jours_planifies,
  COALESCE(tp.cout_rh_planifie,     0) AS cout_rh_planifie,
  COALESCE(td.heures_declarees,     0) AS heures_declarees,
  COALESCE(td.jours_declares,       0) AS jours_declares,
  COALESCE(td.cout_rh_declare,      0) AS cout_rh_declare
FROM public.be_affaires a
LEFT JOIN temps_budgete  tb ON tb.be_affaire_id = a.id
LEFT JOIN temps_planifie tp ON tp.be_affaire_id = a.id
LEFT JOIN temps_declare  td ON td.be_affaire_id = a.id;

COMMENT ON VIEW public.v_be_affaire_temps_kpi IS
  'KPI Temps & RH par affaire BE. Cout RH = heures * taux_horaire_effectif '
  'avec taux_horaire_effectif = be_tjm_fonctions.taux_horaire (via profiles.job_title) '
  'OU be_tjm_referentiel.tjm / 8 (via profiles.be_poste), par ordre de priorité.';

-- 3b. v_be_affaire_temps_par_user (détail collaborateur avec taux horaire effectif)
-- ============================================================================
CREATE OR REPLACE VIEW public.v_be_affaire_temps_par_user AS
SELECT
  a.id                                                                AS be_affaire_id,
  a.code_affaire,
  l.user_id,
  l.id_lucca,
  p.display_name,
  p.job_title,
  p.be_poste,
  COUNT(*)                                                            AS nb_saisies,
  SUM(l.duree_heures)                                                 AS heures,
  SUM(l.duree_heures / 8.0)                                           AS jours,
  COALESCE(fn.taux_horaire, tjm.tjm / 8.0, 0)                        AS taux_horaire_effectif,
  SUM(l.duree_heures
      * COALESCE(fn.taux_horaire, tjm.tjm / 8.0, 0))                 AS cout_rh,
  MIN(l.date_saisie)                                                  AS premiere_saisie,
  MAX(l.date_saisie)                                                  AS derniere_saisie
FROM public.be_affaires a
JOIN public.lucca_saisie_temps l ON l.code_site = a.code_affaire
LEFT JOIN public.profiles p             ON p.id        = l.user_id
LEFT JOIN public.be_tjm_fonctions   fn  ON fn.fonction = p.job_title
LEFT JOIN public.be_tjm_referentiel tjm ON tjm.poste   = p.be_poste
GROUP BY
  a.id, a.code_affaire,
  l.user_id, l.id_lucca,
  p.display_name, p.job_title, p.be_poste,
  fn.taux_horaire, tjm.tjm;

COMMENT ON VIEW public.v_be_affaire_temps_par_user IS
  'Détail du temps déclaré par collaborateur sur une affaire BE. '
  'Expose taux_horaire_effectif (fonction > poste/8) pour transparence du calcul.';

-- 3c. v_be_affaire_temps_par_poste
-- ============================================================================
CREATE OR REPLACE VIEW public.v_be_affaire_temps_par_poste AS
SELECT
  a.id                                          AS be_affaire_id,
  a.code_affaire,
  COALESCE(p.be_poste, 'non_assigne')           AS poste,
  COUNT(DISTINCT l.user_id)                     AS nb_collaborateurs,
  COUNT(*)                                      AS nb_saisies,
  SUM(l.duree_heures)                           AS heures,
  SUM(l.duree_heures / 8.0)                     AS jours,
  SUM(l.duree_heures
      * COALESCE(fn.taux_horaire, tjm.tjm / 8.0, 0)) AS cout_rh
FROM public.be_affaires a
JOIN public.lucca_saisie_temps l ON l.code_site = a.code_affaire
LEFT JOIN public.profiles p             ON p.id        = l.user_id
LEFT JOIN public.be_tjm_fonctions   fn  ON fn.fonction = p.job_title
LEFT JOIN public.be_tjm_referentiel tjm ON tjm.poste   = p.be_poste
GROUP BY a.id, a.code_affaire, COALESCE(p.be_poste, 'non_assigne');

COMMENT ON VIEW public.v_be_affaire_temps_par_poste IS
  'Détail du temps déclaré par poste BE sur une affaire. '
  '''non_assigne'' = collaborateurs Lucca sans be_poste dans leur profil.';

-- 3d. v_be_groupe_kpi (mise à jour Lucca avec taux horaire par fonction)
-- ============================================================================
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
    SUBSTRING(t.code_site, 1, 5)                                AS code_groupe,
    SUM(t.duree_heures)                                         AS heures_declarees,
    SUM(t.duree_heures / 8.0)                                   AS jours_declares,
    SUM(t.duree_heures
        * COALESCE(fn.taux_horaire, tjm.tjm / 8.0, 0))         AS cout_rh_declare,
    COUNT(DISTINCT t.id_lucca)                                  AS nb_collaborateurs
  FROM public.lucca_saisie_temps t
  LEFT JOIN public.profiles p             ON p.id        = t.user_id
  LEFT JOIN public.be_tjm_fonctions   fn  ON fn.fonction = p.job_title
  LEFT JOIN public.be_tjm_referentiel tjm ON tjm.poste   = p.be_poste
  WHERE t.code_site IS NOT NULL AND length(t.code_site) >= 5
  GROUP BY SUBSTRING(t.code_site, 1, 5)
),
groupes_budget AS (
  SELECT
    SUBSTRING(a.code_affaire, 1, 5) AS code_groupe,
    SUM(b.jours_budgetes)                              AS jours_budgetes,
    SUM(b.jours_budgetes * COALESCE(tjm.tjm, 0))      AS cout_rh_budgete
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
  COALESCE(d.ca_constate, 0) - COALESCE(d.cogs_constate, 0)                               AS marge_constatee_brut,
  COALESCE(d.ca_constate, 0) - COALESCE(d.cogs_constate, 0)                               AS marge_brute_brut,
  COALESCE(d.ca_constate, 0) - COALESCE(d.cogs_constate, 0) - COALESCE(l.cout_rh_declare, 0) AS marge_directe_brut,
  COALESCE(d.nb_commandes, 0)          AS nb_commandes,
  COALESCE(d.nb_factures,  0)          AS nb_factures,
  COALESCE(d.nb_activites_divalto, 0)  AS nb_activites_divalto,
  COALESCE(b.jours_budgetes,   0)      AS jours_budgetes,
  COALESCE(b.cout_rh_budgete,  0)      AS cout_rh_budgete,
  COALESCE(l.heures_declarees, 0)      AS heures_declarees,
  COALESCE(l.jours_declares,   0)      AS jours_declares,
  COALESCE(l.cout_rh_declare,  0)      AS cout_rh_declare,
  COALESCE(l.nb_collaborateurs,0)      AS nb_collaborateurs
FROM all_groupes g
LEFT JOIN groupes_divalto    d  ON d.code_groupe  = g.code_groupe
LEFT JOIN groupes_lucca      l  ON l.code_groupe  = g.code_groupe
LEFT JOIN groupes_budget     b  ON b.code_groupe  = g.code_groupe
LEFT JOIN projet_par_groupe  pg ON pg.code_groupe = g.code_groupe;

COMMENT ON VIEW public.v_be_groupe_kpi IS
  'KPI agrégés par "affaire globale" (préfixe 5 chars du code_affaire). '
  'cout_rh_declare valorisé via taux_horaire fonction (priorité) ou TJM poste/8 (fallback).';

-- 4. Vues dépendantes inchangées (recréées après les drops)
-- ============================================================================

-- v_be_affaire_budget_kpi
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

-- v_be_project_budget_kpi
CREATE VIEW public.v_be_project_budget_kpi AS
SELECT
  p.id           AS be_project_id,
  p.code_projet,
  COUNT(DISTINCT a.id) AS nb_affaires,
  COALESCE(SUM(k.ca_engage_brut),       0) AS ca_engage_brut,
  COALESCE(SUM(k.ca_constate_brut),     0) AS ca_constate_brut,
  COALESCE(SUM(k.cogs_engage_brut),     0) AS cogs_engage_brut,
  COALESCE(SUM(k.cogs_constate_brut),   0) AS cogs_constate_brut,
  COALESCE(SUM(k.marge_constatee_brut), 0) AS marge_constatee_brut,
  COALESCE(SUM(k.marge_brute_brut),     0) AS marge_brute_brut,
  COALESCE(SUM(k.marge_directe_brut),   0) AS marge_directe_brut,
  COALESCE(SUM(k.engage_montant_brut),  0) AS engage_montant_brut,
  COALESCE(SUM(k.constate_montant_brut),0) AS constate_montant_brut,
  COALESCE(SUM(k.nb_commandes),         0) AS nb_commandes,
  COALESCE(SUM(k.nb_factures),          0) AS nb_factures
FROM public.be_projects p
LEFT JOIN public.be_affaires a              ON a.be_project_id = p.id
LEFT JOIN public.v_be_affaire_budget_kpi k  ON k.be_affaire_id = a.id
GROUP BY p.id, p.code_projet;

-- v_be_project_synthese_kpi
CREATE VIEW public.v_be_project_synthese_kpi AS
SELECT
  p.id                                     AS be_project_id,
  p.code_projet,
  p.nom_projet,
  p.status,
  COUNT(DISTINCT a.id)                     AS nb_affaires,
  COALESCE(SUM(b.ca_engage_brut),       0) AS ca_engage_brut,
  COALESCE(SUM(b.ca_constate_brut),     0) AS ca_constate_brut,
  COALESCE(SUM(b.cogs_engage_brut),     0) AS cogs_engage_brut,
  COALESCE(SUM(b.cogs_constate_brut),   0) AS cogs_constate_brut,
  COALESCE(SUM(b.marge_constatee_brut), 0) AS marge_constatee_brut,
  COALESCE(SUM(b.marge_brute_brut),     0) AS marge_brute_brut,
  COALESCE(SUM(b.marge_directe_brut),   0) AS marge_directe_brut,
  COALESCE(SUM(b.nb_commandes),         0) AS nb_commandes,
  COALESCE(SUM(b.nb_factures),          0) AS nb_factures,
  COALESCE(SUM(t.jours_budgetes),       0) AS jours_budgetes,
  COALESCE(SUM(t.cout_rh_budgete),      0) AS cout_rh_budgete,
  COALESCE(SUM(t.jours_planifies),      0) AS jours_planifies,
  COALESCE(SUM(t.cout_rh_planifie),     0) AS cout_rh_planifie,
  COALESCE(SUM(t.jours_declares),       0) AS jours_declares,
  COALESCE(SUM(t.cout_rh_declare),      0) AS cout_rh_declare
FROM public.be_projects p
LEFT JOIN public.be_affaires a              ON a.be_project_id = p.id
LEFT JOIN public.v_be_affaire_budget_kpi b  ON b.be_affaire_id = a.id
LEFT JOIN public.v_be_affaire_temps_kpi t   ON t.be_affaire_id = a.id
GROUP BY p.id, p.code_projet, p.nom_projet, p.status;
