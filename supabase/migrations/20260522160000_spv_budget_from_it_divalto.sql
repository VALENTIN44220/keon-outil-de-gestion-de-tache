-- ════════════════════════════════════════════════════════════════════════
-- SPV budget v2 : source COGS = it_divalto_commandes / it_divalto_factures
--
-- be_divalto_mouvements ne contient que les pièces NASKEO (CCN/CFN/FCN/FFN) →
-- les affaires de montage 'M' (TerGreen) n'y sont pas. En revanche les tables
-- it_divalto_* (alimentées depuis MOUV_GOLD, non filtrées) contiennent les
-- pièces M : commandes/factures FOURNISSEUR (achats = COGS).
--
-- Grain affaire = PROJET (5 car. : M + projet). Lucca (ex. MALIX000) et Divalto
-- (axe_0001 = MALIX) ne se rejoignent que sur le projet (les suffixes diffèrent :
-- 000/NDF côté Lucca, ETD/0CT… côté Divalto).
--
-- CA client : aucune pièce client 'M' (CC/FC) dans les sources disponibles →
-- ca_*_brut = 0. À brancher si une source de ventes TerGreen est ajoutée.
-- ════════════════════════════════════════════════════════════════════════

-- Re-seed au grain projet (5 car.) depuis Lucca + it_divalto
DELETE FROM public.spv_affaire_budget_lines;
DELETE FROM public.spv_affaires;

INSERT INTO public.spv_affaires (code_affaire)
SELECT DISTINCT code5 FROM (
  SELECT LEFT(code_site, 5) AS code5 FROM public.lucca_saisie_temps   WHERE code_site ILIKE 'M%'
  UNION SELECT axe_0001            FROM public.it_divalto_commandes    WHERE axe_0001  ILIKE 'M%'
  UNION SELECT axe_0001            FROM public.it_divalto_factures     WHERE axe_0001  ILIKE 'M%'
) u
WHERE code5 IS NOT NULL AND code5 <> ''
ON CONFLICT (code_affaire) DO NOTHING;

-- Temps : grain projet (LEFT 5)
CREATE OR REPLACE VIEW public.v_spv_affaire_temps_kpi AS
SELECT
  LEFT(t.code_site, 5) AS code_affaire,
  SUM(t.duree_heures)                                                          AS heures_declarees,
  SUM(t.duree_heures / 8.0)                                                    AS jours_declares,
  SUM(t.duree_heures * COALESCE(fa.taux_horaire, fm.taux_horaire, 0::numeric)) AS cout_rh_declare,
  COUNT(DISTINCT t.user_id)                                                    AS nb_collaborateurs,
  MIN(t.date_saisie)                                                           AS premiere_saisie,
  MAX(t.date_saisie)                                                           AS derniere_saisie
FROM public.lucca_saisie_temps t
LEFT JOIN public.profiles p          ON p.id = t.user_id
LEFT JOIN public.be_tjm_fonctions fa ON fa.fonction = p.job_title
LEFT JOIN public.be_tjm_fonctions fm ON fm.fonction = p.be_fonction
WHERE t.code_site ILIKE 'M%'
GROUP BY LEFT(t.code_site, 5);

CREATE OR REPLACE VIEW public.v_spv_affaire_temps_par_user AS
SELECT
  LEFT(t.code_site, 5) AS code_affaire,
  t.user_id, p.display_name, p.job_title,
  COALESCE(fa.taux_horaire, fm.taux_horaire, 0::numeric)                       AS taux_horaire,
  SUM(t.duree_heures)                                                          AS heures,
  SUM(t.duree_heures / 8.0)                                                    AS jours,
  SUM(t.duree_heures * COALESCE(fa.taux_horaire, fm.taux_horaire, 0::numeric)) AS cout_rh
FROM public.lucca_saisie_temps t
LEFT JOIN public.profiles p          ON p.id = t.user_id
LEFT JOIN public.be_tjm_fonctions fa ON fa.fonction = p.job_title
LEFT JOIN public.be_tjm_fonctions fm ON fm.fonction = p.be_fonction
WHERE t.code_site ILIKE 'M%'
GROUP BY LEFT(t.code_site, 5), t.user_id, p.display_name, p.job_title, fa.taux_horaire, fm.taux_horaire;

-- Budget KPI : COGS depuis it_divalto (fournisseur), CA=0 (pas de source client M)
CREATE OR REPLACE VIEW public.v_spv_affaire_budget_kpi AS
WITH temps AS (
  SELECT code_affaire, jours_declares, cout_rh_declare FROM public.v_spv_affaire_temps_kpi
),
cogs_eng AS (
  SELECT axe_0001 AS code_affaire, SUM(montant_ht) AS m, COUNT(DISTINCT fullcdno) AS nb
  FROM public.it_divalto_commandes WHERE axe_0001 ILIKE 'M%' GROUP BY axe_0001
),
cogs_con AS (
  SELECT axe_0001 AS code_affaire, SUM(montant_ht) AS m, COUNT(DISTINCT reference) AS nb
  FROM public.it_divalto_factures WHERE axe_0001 ILIKE 'M%' GROUP BY axe_0001
),
budget AS (
  SELECT spv_affaire_id, SUM(COALESCE(montant_budget_revise, montant_budget)) AS budget_total
  FROM public.spv_affaire_budget_lines GROUP BY spv_affaire_id
)
SELECT
  a.id          AS spv_affaire_id,
  a.code_affaire,
  a.libelle     AS affaire_libelle,
  a.status      AS affaire_status,
  0::numeric                       AS ca_engage_brut,
  0::numeric                       AS ca_constate_brut,
  COALESCE(ce.m, 0::numeric)       AS cogs_engage_brut,
  COALESCE(cc.m, 0::numeric)       AS cogs_constate_brut,
  (0::numeric - COALESCE(cc.m, 0::numeric))                                   AS marge_brute,
  (0::numeric - COALESCE(cc.m, 0::numeric) - COALESCE(t.cout_rh_declare, 0))  AS marge_directe,
  COALESCE(ce.nb, 0)               AS nb_commandes,
  COALESCE(cc.nb, 0)               AS nb_factures,
  COALESCE(t.jours_declares, 0::numeric)   AS jours_declares,
  COALESCE(t.cout_rh_declare, 0::numeric)  AS cout_rh_declare,
  COALESCE(b.budget_total, 0::numeric)     AS budget_total
FROM public.spv_affaires a
LEFT JOIN temps t     ON t.code_affaire = a.code_affaire
LEFT JOIN cogs_eng ce ON ce.code_affaire = a.code_affaire
LEFT JOIN cogs_con cc ON cc.code_affaire = a.code_affaire
LEFT JOIN budget b    ON b.spv_affaire_id = a.id;
