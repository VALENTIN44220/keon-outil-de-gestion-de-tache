-- Migration : fonction de synchronisation automatique des affaires BE depuis Divalto
--
-- Critères métier :
--   code_affaire commençant par A ou E
--   ET se terminant par l'un des suffixes activité BE :
--   000 ABO AUD CO2 EDF ETD EXE GNV ICP MOE PCU PPV RAC SAN SUB
--
-- Appelée via supabase.rpc('sync_be_affaires_from_divalto') à chaque ouverture
-- de l'app (throttlée côté client, max 1x/30 min).

CREATE OR REPLACE FUNCTION public.sync_be_affaires_from_divalto()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nb_projets_crees  integer := 0;
  v_nb_affaires_crees integer := 0;
BEGIN
  -- 1. Codes Divalto éligibles non encore dans be_affaires
  CREATE TEMP TABLE _be_sync_new ON COMMIT DROP AS
  SELECT DISTINCT ON (d.code_affaire)
    d.code_affaire,
    d.libelle                                       AS libelle,
    UPPER(SUBSTRING(d.code_affaire FROM 2 FOR 4))  AS code_projet
  FROM divalto_mouvements_all d
  WHERE
    d.code_affaire IS NOT NULL
    AND d.code_affaire <> ''
    AND LEFT(d.code_affaire, 1) IN ('A', 'E')
    AND RIGHT(d.code_affaire, 3) IN (
      '000','ABO','AUD','CO2','EDF','ETD','EXE','GNV','ICP',
      'MOE','PCU','PPV','RAC','SAN','SUB'
    )
    AND LENGTH(d.code_affaire) >= 5
    AND NOT EXISTS (
      SELECT 1 FROM be_affaires a WHERE a.code_affaire = d.code_affaire
    )
  ORDER BY d.code_affaire, d.synced_at DESC;

  -- 2. Projets manquants — fiche minimale (nom à compléter depuis la liste BE)
  INSERT INTO be_projects (code_projet, nom_projet, status)
  SELECT DISTINCT
    s.code_projet,
    '[À compléter] ' || s.code_projet,
    'active'
  FROM _be_sync_new s
  WHERE s.code_projet IS NOT NULL
  ON CONFLICT (code_projet) DO NOTHING;

  GET DIAGNOSTICS v_nb_projets_crees = ROW_COUNT;

  -- 3. Affaires manquantes
  INSERT INTO be_affaires (be_project_id, code_affaire, libelle, status, source_creation)
  SELECT
    p.id,
    s.code_affaire,
    s.libelle,
    'ouverte',
    'import'
  FROM _be_sync_new s
  JOIN be_projects p ON p.code_projet = s.code_projet
  ON CONFLICT (code_affaire) DO NOTHING;

  GET DIAGNOSTICS v_nb_affaires_crees = ROW_COUNT;

  RETURN jsonb_build_object(
    'nb_projets_crees',  v_nb_projets_crees,
    'nb_affaires_crees', v_nb_affaires_crees
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_be_affaires_from_divalto() TO authenticated;
