-- =========================================================
-- Migration: questionnaire_field_definitions + project_field_values
--
-- Sépare la définition des champs (métadonnées) des valeurs
-- par projet. project_questionnaire est conservée comme backup.
-- =========================================================

-- TABLE 1 : Définitions des champs (le "schéma" du formulaire)
-- Une seule ligne par champ, commune à tous les projets.
CREATE TABLE public.questionnaire_field_definitions (
  id                    UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  champ_id              TEXT NOT NULL UNIQUE,
  pilier_code           TEXT NOT NULL,
  section               TEXT NOT NULL,
  sous_section          TEXT,
  label                 TEXT NOT NULL,
  type_champ            TEXT NOT NULL CHECK (type_champ IN ('text','textarea','select','number','percentage','euros')),
  options               TEXT[],
  note                  TEXT,
  has_evaluation_risque BOOLEAN NOT NULL DEFAULT false,
  required              BOOLEAN NOT NULL DEFAULT false,
  order_index           INTEGER NOT NULL DEFAULT 0,
  is_builtin            BOOLEAN NOT NULL DEFAULT true,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_by            UUID REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_qfd_pilier  ON public.questionnaire_field_definitions(pilier_code);
CREATE INDEX idx_qfd_active  ON public.questionnaire_field_definitions(is_active);
CREATE INDEX idx_qfd_section ON public.questionnaire_field_definitions(pilier_code, section);

-- TABLE 2 : Valeurs par projet (remplace project_questionnaire)
CREATE TABLE public.project_field_values (
  id                UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id        UUID NOT NULL REFERENCES public.be_projects(id) ON DELETE CASCADE,
  field_def_id      UUID NOT NULL REFERENCES public.questionnaire_field_definitions(id) ON DELETE CASCADE,
  valeur            TEXT,
  valeur_evaluation TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID REFERENCES public.profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, field_def_id)
);

CREATE INDEX idx_pfv_project   ON public.project_field_values(project_id);
CREATE INDEX idx_pfv_field_def ON public.project_field_values(field_def_id);

-- =========================================================
-- Trigger updated_at
-- =========================================================

CREATE OR REPLACE FUNCTION update_project_field_values_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_project_field_values_updated_at
BEFORE UPDATE ON public.project_field_values
FOR EACH ROW EXECUTE FUNCTION update_project_field_values_updated_at();

-- =========================================================
-- Insertion des champs builtin (depuis questionnaireConfig.ts)
-- =========================================================

INSERT INTO public.questionnaire_field_definitions
  (champ_id, pilier_code, section, sous_section, label, type_champ, options, note, has_evaluation_risque, required, order_index, is_builtin)
VALUES
  -- PILIER 00 — PROCESS INTERNE
  ('00_GEN_typologie',         '00', 'GENERALITES', NULL,                      'Typologie de projet',                                         'select',     ARRAY['GREENFIELD EARLY','GREENFIELD LATE','BROWNFIELD'],                NULL,                                                        false, false,  10, true),
  ('00_GEN_resp1',             '00', 'GENERALITES', NULL,                      'Responsable de projet 1',                                     'text',       NULL, 'Liste des noms des salariés KEON',                                                          false, false,  20, true),
  ('00_GEN_resp2',             '00', 'GENERALITES', NULL,                      'Responsable de projet 2',                                     'text',       NULL, 'Liste des noms des salariés KEON',                                                          false, false,  30, true),
  ('00_GEN_resp3',             '00', 'GENERALITES', NULL,                      'Responsable de projet 3',                                     'text',       NULL, 'Liste des noms des salariés KEON',                                                          false, false,  40, true),
  ('00_GEN_resp4',             '00', 'GENERALITES', NULL,                      'Responsable de projet 4',                                     'text',       NULL, 'Liste des noms des salariés KEON',                                                          false, false,  50, true),
  ('00_GEN_resp_actuel',       '00', 'GENERALITES', NULL,                      'Responsable de projet actuel',                                'text',       NULL, 'Liste des noms des salariés KEON',                                                          false, false,  60, true),

  -- PILIER 02 — SPV
  ('02_GEN_spv_cree',          '02', 'GENERALITES', 'Données admin.',           'SPV créée ?',                                                 'select',     ARRAY['OUI','NON','EN COURS','EN ATTENTE','A LANCER','?'],              NULL,                                                        false, false,  10, true),
  ('02_GEN_raison_sociale',    '02', 'GENERALITES', 'Données admin.',           'Raison sociale',                                              'text',       NULL, NULL,                                                               false, false,  20, true),
  ('02_GEN_capital_social',    '02', 'GENERALITES', 'Données admin.',           'Capital social actuel de la SPV (€)',                         'euros',      NULL, NULL,                                                               false, false,  30, true),
  ('02_GEN_president',         '02', 'GENERALITES', 'Données admin.',           'Nom du président',                                            'text',       NULL, NULL,                                                               false, false,  40, true),
  ('02_CAPI_keon_pct',         '02', 'TABLE DE CAPI ET CCA', 'Phase 2',        'Keon.co - KS (%)',                                            'percentage', NULL, 'Attention, le % peut évoluer — à gérer plus tard',                 false, false,  10, true),
  ('02_GOV_majorite_simple',   '02', 'GOUVERNANCE', 'CODIR',                   'Majorité simple du CODIR',                                    'text',       NULL, 'Format X/X ou X%',                                                 false, false,  10, true),
  ('02_GOV_majorite_qualifiee','02', 'GOUVERNANCE', 'CODIR',                   'Majorité qualifiée du CODIR',                                 'text',       NULL, 'Format X/X ou X%',                                                 false, false,  20, true),

  -- PILIER 04 — FONCIER
  ('04_GEN_pays',              '04', 'GENERALITES', 'Localisation',             'Pays',                                                        'text',       NULL, NULL,                                                               false, false,  10, true),
  ('04_GEN_region',            '04', 'GENERALITES', 'Localisation',             'Région',                                                      'text',       NULL, NULL,                                                               false, false,  20, true),
  ('04_GEN_departement_nom',   '04', 'GENERALITES', 'Localisation',             'Département — Nom',                                           'text',       NULL, 'Si France : liste des départements. Sinon titre / objet.',            false, false,  30, true),
  ('04_GEN_departement_num',   '04', 'GENERALITES', 'Localisation',             'Département — N°',                                            'text',       NULL, NULL,                                                               false, false,  40, true),
  ('04_GEN_commune',           '04', 'GENERALITES', 'Localisation',             'Commune',                                                     'text',       NULL, NULL,                                                               false, false,  50, true),
  ('04_GEN_code_postal',       '04', 'GENERALITES', 'Localisation',             'Code postal',                                                 'text',       NULL, NULL,                                                               false, false,  60, true),
  ('04_GEN_type_foncier',      '04', 'GENERALITES', 'Type de foncier',          'Type de foncier',                                             'select',     ARRAY['Agricole','Industriel','Autre'],                                  NULL,                                                        false, false,  70, true),
  ('04_GEN_surface_m2',        '04', 'GENERALITES', 'Parcelle entière',         'Surface totale de la parcelle (m²)',                          'number',     NULL, NULL,                                                               false, false,  80, true),
  ('04_GEN_proprietaire_p1',   '04', 'GENERALITES', 'Parcelle 1',               'Propriétaire actuel (Parcelle 1)',                            'text',       NULL, NULL,                                                               false, false,  90, true),
  ('04_URB_doc_urbanisme',     '04', 'URBANISME',   'Généralités',              'Document d''urbanisme en vigueur en début de projet',         'select',     ARRAY['PLU','RNU','Carte communale'],                                   NULL,                                                        false, false,  10, true),
  ('04_URB_zonage_debut',      '04', 'URBANISME',   'Généralités',              'Zonage en début de projet',                                   'text',       NULL, NULL,                                                               false, false,  20, true),
  ('04_URB_zonage_contraignant','04','URBANISME',   'Généralités',              'Zonage contraignant ?',                                       'text',       NULL, NULL,                                                               false, false,  30, true),
  ('04_SEC_p1_niv1_avancement','04', 'SECURISATION','Parcelle 1',               'Sécurisation niveau 1 : avancement',                         'select',     ARRAY['NC','A LANCER','A DEMARRER','EN COURS','EN ATTENTE','SIGNE','LOI SIGNEE','ACHETE'], NULL,                                  false, false,  10, true),
  ('04_SEC_p1_niv2_type',      '04', 'SECURISATION','Parcelle 1',               'Sécurisation niveau 2 : type',                               'select',     ARRAY['Compromis de vente','Promesse de bail','NC','EN COURS','LOI SIGNEE','ACHETE'],       NULL,                                  false, false,  20, true),
  ('04_SEC_p2_niv2_type',      '04', 'SECURISATION','Parcelle 2',               'Sécurisation niveau 2 : type',                               'select',     ARRAY['Compromis de vente','Promesse de bail','NC','EN COURS','LOI SIGNEE','ACHETE'],       NULL,                                  false, false,  30, true),
  ('04_SEC_p3_niv2_type',      '04', 'SECURISATION','Parcelle 3',               'Sécurisation niveau 2 : type',                               'select',     ARRAY['Compromis de vente','Promesse de bail','NC','EN COURS','LOI SIGNEE','ACHETE'],       NULL,                                  false, false,  40, true),

  -- PILIER 05 — GAZ
  ('05_GEN_cmax1',                  '05', 'GENERALITES',              'Evolution Cmax',      'Cmax 1 (Nm³CH4/h)',                                           'number',     NULL, NULL,                                                               false, false,  10, true),
  ('05_GEN_cmax2',                  '05', 'GENERALITES',              'Evolution Cmax',      'Cmax 2 (Nm³CH4/h)',                                           'number',     NULL, NULL,                                                               false, false,  20, true),
  ('05_GEN_cmax3',                  '05', 'GENERALITES',              'Evolution Cmax',      'Cmax 3 (Nm³CH4/h)',                                           'number',     NULL, NULL,                                                               false, false,  30, true),
  ('05_GEN_gestionnaire_reseau',    '05', 'GENERALITES',              'Réseau d''injection', 'Nom du gestionnaire de réseau',                               'text',       NULL, 'Ex : GRDF, GRT GAZ, Natran',                                       false, false,  40, true),
  ('05_INJ_etiage_pct',             '05', 'INJECTION',                'Etude détaillée',     '% d''étiage / écrêtement (étude préalable)',                  'percentage', NULL, NULL,                                                               false, false,  10, true),
  ('05_CONTRAT_mecanisme1',         '05', 'CONTRAT DE VENTE DE BIOMETHANE', 'Mécanisme tarifaire', 'Type de mécanisme tarifaire privilégié (1er choix)',    'text',       NULL, 'Ex : Tarif 2011, Tarif 2020, CPB, BPA',                            false, false,  10, true),
  ('05_CONTRAT_mecanisme2',         '05', 'CONTRAT DE VENTE DE BIOMETHANE', 'Mécanisme tarifaire', 'Type de mécanisme tarifaire (2ème choix)',              'text',       NULL, NULL,                                                               false, false,  20, true),
  ('05_EVO_debit_max_injection',    '05', 'EVOLUTIVITE',              'Injection',           'Débit maximal prévu par le débit d''injection (Nm³CH4/h)',    'number',     NULL, NULL,                                                               false, false,  10, true),

  -- PILIER 06 — GISEMENT
  ('06_GEN_statut_agricole',        '06', 'INFORMATIONS GENERALES', NULL, 'Statut agricole ?',                                                'select',     ARRAY['Oui','Non','NC'],                                                NULL,                                                        true,  false,  10, true),
  ('06_GEN_quantite_totale',        '06', 'INFORMATIONS GENERALES', NULL, 'Quantité totale de gisement (tMB/an)',                             'number',     NULL, 'La quantité est-elle conforme à l''ICPE envisagée ?',               false, false,  20, true),
  ('06_GEN_pct_effluents',          '06', 'INFORMATIONS GENERALES', NULL, 'Dont % effluents d''élevage',                                      'percentage', NULL, 'Conforme au tarif et aux subventions envisagés ?',                  false, false,  30, true),
  ('06_GEN_pct_cultures',           '06', 'INFORMATIONS GENERALES', NULL, 'Dont % cultures',                                                  'percentage', NULL, 'Si statut agricole : doit être > 50%',                              false, false,  40, true),
  ('06_GEN_pct_dechets_iaa',        '06', 'INFORMATIONS GENERALES', NULL, 'Dont % déchets IAA et biodéchets',                                'percentage', NULL, NULL,                                                               false, false,  50, true),
  ('06_GEN_pct_maitrise_actionnaires','06','INFORMATIONS GENERALES', NULL, 'Dont % maîtrisés par les actionnaires',                          'percentage', NULL, NULL,                                                               false, false,  60, true),
  ('06_GEN_taux_sous_contrat',      '06', 'INFORMATIONS GENERALES', NULL, 'Taux de productible biométhane sous contrat (%)',                  'percentage', NULL, NULL,                                                               false, false,  70, true),
  ('06_GEN_taux_sous_loi',          '06', 'INFORMATIONS GENERALES', NULL, 'Taux de productible biométhane sous LOI (%)',                      'percentage', NULL, NULL,                                                               true,  false,  80, true),

  -- PILIER 07 — DIGESTAT
  ('07_DIG_eligible_digagri',        '07', 'PLAN D''EPANDAGE', 'DIGAGRI',         'Éligible au digagri ?',         'select', ARRAY['Oui','Non','NC'], NULL, false, false, 10, true),
  ('07_DIG_plan_epandage_necessaire','07', 'PLAN D''EPANDAGE', 'PLAN D''EPANDAGE','Plan d''épandage nécessaire ?', 'select', ARRAY['Oui','Non','NC'], NULL, false, false, 20, true),
  ('07_DIG_surface_epandable',       '07', 'PLAN D''EPANDAGE', 'PLAN D''EPANDAGE','Surface épandable (ha)',        'number', NULL,                   NULL, false, false, 30, true);

-- =========================================================
-- Migration des données existantes depuis project_questionnaire
-- =========================================================

INSERT INTO public.project_field_values
  (project_id, field_def_id, valeur, valeur_evaluation, updated_at, updated_by, created_at)
SELECT
  pq.project_id,
  fd.id,
  pq.valeur,
  pq.valeur_evaluation,
  COALESCE(pq.updated_at, now()),
  pq.updated_by,
  COALESCE(pq.created_at, now())
FROM public.project_questionnaire pq
JOIN public.questionnaire_field_definitions fd ON fd.champ_id = pq.champ_id
ON CONFLICT (project_id, field_def_id) DO NOTHING;

-- =========================================================
-- RLS — questionnaire_field_definitions
-- Lecture : tout utilisateur authentifié
-- Création : tout utilisateur authentifié (champs custom uniquement)
-- Modification : créateur du champ ou admin
-- =========================================================

ALTER TABLE public.questionnaire_field_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qfd_select"
ON public.questionnaire_field_definitions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "qfd_insert"
ON public.questionnaire_field_definitions FOR INSERT
TO authenticated
WITH CHECK (is_builtin = false AND auth.uid() IS NOT NULL);

CREATE POLICY "qfd_update"
ON public.questionnaire_field_definitions FOR UPDATE
TO authenticated
USING (
  is_builtin = false
  AND (
    created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  )
)
WITH CHECK (is_builtin = false);

-- =========================================================
-- RLS — project_field_values
-- Identique à project_questionnaire, le pilier_code est
-- résolu via la jointure avec questionnaire_field_definitions.
-- =========================================================

ALTER TABLE public.project_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pfv_select"
ON public.project_field_values FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.questionnaire_field_definitions fd
    JOIN public.profiles p ON p.user_id = auth.uid()
    JOIN public.permission_profiles pp ON pp.id = p.permission_profile_id
    WHERE fd.id = project_field_values.field_def_id
      AND (
        (fd.pilier_code = '00' AND pp.qst_pilier_00_read = true) OR
        (fd.pilier_code = '02' AND pp.qst_pilier_02_read = true) OR
        (fd.pilier_code = '04' AND pp.qst_pilier_04_read = true) OR
        (fd.pilier_code = '05' AND pp.qst_pilier_05_read = true) OR
        (fd.pilier_code = '06' AND pp.qst_pilier_06_read = true) OR
        (fd.pilier_code = '07' AND pp.qst_pilier_07_read = true)
      )
  )
  -- Les champs custom (pilier non référencé) sont lisibles par tous
  OR EXISTS (
    SELECT 1
    FROM public.questionnaire_field_definitions fd
    WHERE fd.id = project_field_values.field_def_id
      AND fd.is_builtin = false
  )
);

CREATE POLICY "pfv_insert"
ON public.project_field_values FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.questionnaire_field_definitions fd
    JOIN public.profiles p ON p.user_id = auth.uid()
    JOIN public.permission_profiles pp ON pp.id = p.permission_profile_id
    WHERE fd.id = project_field_values.field_def_id
      AND (
        (fd.pilier_code = '00' AND pp.qst_pilier_00_write = true) OR
        (fd.pilier_code = '02' AND pp.qst_pilier_02_write = true) OR
        (fd.pilier_code = '04' AND pp.qst_pilier_04_write = true) OR
        (fd.pilier_code = '05' AND pp.qst_pilier_05_write = true) OR
        (fd.pilier_code = '06' AND pp.qst_pilier_06_write = true) OR
        (fd.pilier_code = '07' AND pp.qst_pilier_07_write = true)
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.questionnaire_field_definitions fd
    WHERE fd.id = project_field_values.field_def_id AND fd.is_builtin = false
  )
);

CREATE POLICY "pfv_update"
ON public.project_field_values FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.questionnaire_field_definitions fd
    JOIN public.profiles p ON p.user_id = auth.uid()
    JOIN public.permission_profiles pp ON pp.id = p.permission_profile_id
    WHERE fd.id = project_field_values.field_def_id
      AND (
        (fd.pilier_code = '00' AND pp.qst_pilier_00_write = true) OR
        (fd.pilier_code = '02' AND pp.qst_pilier_02_write = true) OR
        (fd.pilier_code = '04' AND pp.qst_pilier_04_write = true) OR
        (fd.pilier_code = '05' AND pp.qst_pilier_05_write = true) OR
        (fd.pilier_code = '06' AND pp.qst_pilier_06_write = true) OR
        (fd.pilier_code = '07' AND pp.qst_pilier_07_write = true)
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.questionnaire_field_definitions fd
    WHERE fd.id = project_field_values.field_def_id AND fd.is_builtin = false
  )
);
