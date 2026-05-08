-- ============================================================================
-- BE - Vues pour : (1) detail mensuel temps Lucca + (2) import affaires Divalto
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. v_be_temps_detail_mensuel
-- ----------------------------------------------------------------------------
-- Vue flat : 1 ligne = (mois x code_affaire x user x poste BE)
-- Source = lucca_saisie_temps. Jointure sur be_affaires (code_site = code_affaire)
-- pour exposer be_affaire_id et be_project_id (NULL si l'affaire n'est pas encore
-- importee dans be_affaires, ce qui permet de detecter les saisies orphelines).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_be_temps_detail_mensuel AS
SELECT
  date_trunc('month', t.date_saisie)::date     AS mois,
  t.code_site                                  AS code_affaire,
  a.id                                         AS be_affaire_id,
  a.libelle                                    AS affaire_libelle,
  a.be_project_id,
  t.user_id,
  p.display_name                               AS user_display_name,
  COALESCE(p.be_poste, 'autre')                AS poste,
  SUM(t.duree_heures)                          AS heures,
  SUM(t.duree_heures / 8.0)                    AS jours,
  SUM(t.duree_heures / 8.0 * COALESCE(tjm.tjm, 0)) AS cout_rh,
  COUNT(*)                                     AS nb_saisies
FROM public.lucca_saisie_temps t
LEFT JOIN public.be_affaires a          ON a.code_affaire = t.code_site
LEFT JOIN public.profiles p             ON p.id = t.user_id
LEFT JOIN public.be_tjm_referentiel tjm ON tjm.poste = COALESCE(p.be_poste, 'autre')
GROUP BY 1, 2, 3, 4, 5, 6, 7, 8;

COMMENT ON VIEW public.v_be_temps_detail_mensuel IS
  'Detail flat des saisies de temps Lucca, agrege par (mois x code_affaire x user x poste). Une affaire absente de be_affaires (be_affaire_id IS NULL) signale une saisie orpheline.';

-- ----------------------------------------------------------------------------
-- 2. v_be_divalto_affaires_to_import
-- ----------------------------------------------------------------------------
-- Vue support pour l'ecran d'import en masse. Liste les codes_affaire presents
-- dans Divalto (be_divalto_mouvements) qui ne sont PAS encore dans be_affaires,
-- avec :
--   - libelle Divalto le plus frequent
--   - volume (nb pieces, montant total)
--   - 1er char = categorie metier (filtre A / E / etc.)
--   - chars 2-5 = code projet parent attendu + flag d'existence
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_be_divalto_affaires_to_import AS
WITH divalto_codes AS (
  SELECT
    code_affaire,
    COUNT(DISTINCT numero_piece)            AS nb_pieces,
    SUM(ABS(COALESCE(montant_ht, 0)))       AS montant_total,
    MIN(date_piece)                         AS premier_mouvement,
    MAX(date_piece)                         AS dernier_mouvement,
    mode() WITHIN GROUP (ORDER BY libelle)  AS libelle_principal
  FROM public.be_divalto_mouvements
  WHERE code_affaire IS NOT NULL
    AND code_affaire <> ''
  GROUP BY code_affaire
)
SELECT
  d.code_affaire,
  d.libelle_principal,
  d.nb_pieces,
  d.montant_total,
  d.premier_mouvement,
  d.dernier_mouvement,
  UPPER(LEFT(d.code_affaire, 1))            AS categorie,
  CASE
    WHEN LENGTH(d.code_affaire) >= 5 THEN UPPER(SUBSTRING(d.code_affaire FROM 2 FOR 4))
    ELSE NULL
  END                                       AS code_projet_parent,
  EXISTS (
    SELECT 1 FROM public.be_projects bp
    WHERE LENGTH(d.code_affaire) >= 5
      AND UPPER(bp.code_projet) = UPPER(SUBSTRING(d.code_affaire FROM 2 FOR 4))
  )                                         AS parent_project_exists
FROM divalto_codes d
WHERE NOT EXISTS (
  SELECT 1 FROM public.be_affaires a
  WHERE a.code_affaire = d.code_affaire
)
ORDER BY d.code_affaire;

COMMENT ON VIEW public.v_be_divalto_affaires_to_import IS
  'Codes_affaire presents dans Divalto et absents de be_affaires. Utilise par l''ecran d''import en masse /be/admin/divalto-import.';
