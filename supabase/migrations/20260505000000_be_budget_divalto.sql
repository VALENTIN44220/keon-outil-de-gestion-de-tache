-- ============================================================================
-- Module BE - Suivi budget par affaire (Divalto)
-- ============================================================================
-- Modele :
--   be_projects (1) ----< (N) be_affaires (1) ----< (N) be_affaire_budget_lines
--                                  |
--                                  | code_affaire (TEXT, ex: 'EDOLEAEX')
--                                  v
--                          be_divalto_mouvements (mirror de mouv_gold)
--
-- Cle de jointure Divalto : be_affaires.code_affaire (= axe_0001||axe_0002 dans mouv_gold).
-- Convention montants (alignee sur it_divalto_factures) :
--   - source = 'gescom' : montant_ht est le HT reel
--   - source = 'compta' : montant_ht contient en realite le TTC
--   -> calcul HT consolide cote application (TVA 20%).
--
-- Granularite mouvements : 1 ligne par (numero_piece, source). Si une piece
-- est multi-imputee analytiquement, le notebook Fabric agrege par (piece, source)
-- avant insert (on conserve l'imputation dominante).
--
-- Creation d'une affaire :
--   - phase 1 (immediate) : creation manuelle depuis l'UI BE
--   - phase 2 (post-F1)   : auto-creation via le flux de demandes BE
-- ============================================================================

-- 1. Affaires BE (1 projet -> N affaires)
CREATE TABLE IF NOT EXISTS public.be_affaires (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  be_project_id       UUID         NOT NULL REFERENCES public.be_projects(id) ON DELETE RESTRICT,
  -- Code analytique Divalto, ex: 'EDOLEAEX'. Cle de jointure mouvements + temps Lucca.
  -- Les caracteres 2-5 representent traditionnellement le projet (ex: 'DOLE') -
  -- exploite cote UI pour suggerer le projet au moment de creer une affaire,
  -- mais le rattachement reste explicite via be_project_id.
  code_affaire        TEXT         NOT NULL,
  libelle             TEXT,
  description         TEXT,
  -- Statut du cycle de vie de l'affaire
  status              TEXT         NOT NULL DEFAULT 'ouverte'
                        CHECK (status IN ('ouverte','en_cours','suspendue','cloturee','annulee')),
  date_ouverture      DATE         DEFAULT CURRENT_DATE,
  date_cloture        DATE,
  -- Source de creation (manuelle pour l'instant, 'demande' a venir avec F1)
  source_creation     TEXT         NOT NULL DEFAULT 'manuelle'
                        CHECK (source_creation IN ('manuelle','demande_be','import')),
  -- Lien optionnel vers la demande BE qui a genere l'affaire (post-F1)
  source_request_id   UUID         REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_by          UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT be_affaires_code_affaire_unique UNIQUE (code_affaire)
);

CREATE INDEX IF NOT EXISTS idx_be_affaires_project ON public.be_affaires(be_project_id);
CREATE INDEX IF NOT EXISTS idx_be_affaires_status  ON public.be_affaires(status);

ALTER TABLE public.be_affaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read be_affaires"
  ON public.be_affaires FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert be_affaires"
  ON public.be_affaires FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update be_affaires"
  ON public.be_affaires FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete be_affaires"
  ON public.be_affaires FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_be_affaires_updated_at
  BEFORE UPDATE ON public.be_affaires
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Table miroir des mouvements Divalto (1 ligne par piece x source)
CREATE TABLE IF NOT EXISTS public.be_divalto_mouvements (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identification piece
  numero_piece        TEXT         NOT NULL,
  prefpino            TEXT         NOT NULL,
  type_mouv           TEXT         NOT NULL CHECK (type_mouv IN ('CCN','CFK','FCN','FFK')),
  source              TEXT         NOT NULL CHECK (source IN ('gescom','compta')),
  -- Analytique (axes Divalto)
  axe_0001            TEXT,
  axe_0002            TEXT,
  code_affaire        TEXT GENERATED ALWAYS AS (
    NULLIF(COALESCE(axe_0001, '') || COALESCE(axe_0002, ''), '')
  ) STORED,
  -- Metadata piece
  date_piece          DATE,
  exercice            INT,
  tiers_code          TEXT,
  nom_tiers           TEXT,
  libelle             TEXT,
  compte_general      TEXT,
  -- Montants (HT reel pour gescom, TTC pour compta)
  montant_ht          NUMERIC(14,2),
  montant_tva         NUMERIC(14,2),
  devise              TEXT         DEFAULT 'EUR',
  -- Sync Fabric
  fabric_synced_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  raw                 JSONB,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT be_divalto_mouvements_piece_source_unique UNIQUE (numero_piece, source)
);

CREATE INDEX IF NOT EXISTS idx_be_div_mouv_code_affaire ON public.be_divalto_mouvements(code_affaire);
CREATE INDEX IF NOT EXISTS idx_be_div_mouv_type_mouv    ON public.be_divalto_mouvements(type_mouv);
CREATE INDEX IF NOT EXISTS idx_be_div_mouv_date         ON public.be_divalto_mouvements(date_piece);
CREATE INDEX IF NOT EXISTS idx_be_div_mouv_exercice     ON public.be_divalto_mouvements(exercice);

ALTER TABLE public.be_divalto_mouvements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read be_divalto_mouvements"
  ON public.be_divalto_mouvements FOR SELECT TO authenticated USING (true);

-- Ecriture reservee au service_role (notebook Fabric).

CREATE TRIGGER update_be_divalto_mouvements_updated_at
  BEFORE UPDATE ON public.be_divalto_mouvements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Lignes budgetaires previsionnelles - rattachees a l'AFFAIRE
CREATE TABLE IF NOT EXISTS public.be_affaire_budget_lines (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  be_affaire_id            UUID          NOT NULL REFERENCES public.be_affaires(id) ON DELETE CASCADE,
  poste                    TEXT          NOT NULL,
  fournisseur_prevu        TEXT,
  description              TEXT,
  montant_budget           NUMERIC(14,2) NOT NULL,
  montant_budget_revise    NUMERIC(14,2),
  type_depense             TEXT,
  exercice                 INT,
  statut                   TEXT          NOT NULL DEFAULT 'brouillon'
                              CHECK (statut IN ('brouillon','valide','engage_partiel','engage_total','facture_partiel','facture_total','clos','anomalie')),
  commentaire              TEXT,
  created_by               UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_be_budget_lines_affaire  ON public.be_affaire_budget_lines(be_affaire_id);
CREATE INDEX IF NOT EXISTS idx_be_budget_lines_exercice ON public.be_affaire_budget_lines(exercice);

ALTER TABLE public.be_affaire_budget_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read be_affaire_budget_lines"
  ON public.be_affaire_budget_lines FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert be_affaire_budget_lines"
  ON public.be_affaire_budget_lines FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update be_affaire_budget_lines"
  ON public.be_affaire_budget_lines FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete be_affaire_budget_lines"
  ON public.be_affaire_budget_lines FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_be_affaire_budget_lines_updated_at
  BEFORE UPDATE ON public.be_affaire_budget_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Liens N<->N : ligne budget <-> commande Divalto (CCN/CFK)
-- numero_piece n'est PAS une FK : les pieces Divalto peuvent etre purgees/resynchronisees.
CREATE TABLE IF NOT EXISTS public.be_budget_line_commandes (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_line_id      UUID         NOT NULL REFERENCES public.be_affaire_budget_lines(id) ON DELETE CASCADE,
  numero_piece        TEXT         NOT NULL,
  created_by          UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT be_budget_line_commandes_unique UNIQUE (budget_line_id, numero_piece)
);

CREATE INDEX IF NOT EXISTS idx_be_blc_numero_piece ON public.be_budget_line_commandes(numero_piece);

ALTER TABLE public.be_budget_line_commandes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read be_budget_line_commandes"
  ON public.be_budget_line_commandes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert be_budget_line_commandes"
  ON public.be_budget_line_commandes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete be_budget_line_commandes"
  ON public.be_budget_line_commandes FOR DELETE TO authenticated USING (true);

-- 5. Liens N<->N : ligne budget <-> facture Divalto (FCN/FFK)
CREATE TABLE IF NOT EXISTS public.be_budget_line_factures (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_line_id      UUID         NOT NULL REFERENCES public.be_affaire_budget_lines(id) ON DELETE CASCADE,
  numero_piece        TEXT         NOT NULL,
  created_by          UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT be_budget_line_factures_unique UNIQUE (budget_line_id, numero_piece)
);

CREATE INDEX IF NOT EXISTS idx_be_blf_numero_piece ON public.be_budget_line_factures(numero_piece);

ALTER TABLE public.be_budget_line_factures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read be_budget_line_factures"
  ON public.be_budget_line_factures FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert be_budget_line_factures"
  ON public.be_budget_line_factures FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete be_budget_line_factures"
  ON public.be_budget_line_factures FOR DELETE TO authenticated USING (true);

-- 6. Vue d'agregation engage / constate par AFFAIRE
CREATE OR REPLACE VIEW public.v_be_affaire_budget_kpi AS
SELECT
  a.id              AS be_affaire_id,
  a.be_project_id,
  a.code_affaire,
  a.libelle         AS affaire_libelle,
  a.status          AS affaire_status,
  COALESCE(SUM(CASE WHEN m.type_mouv IN ('CCN','CFK') THEN m.montant_ht END), 0) AS engage_montant_brut,
  COALESCE(SUM(CASE WHEN m.type_mouv IN ('FCN','FFK') THEN m.montant_ht END), 0) AS constate_montant_brut,
  COUNT(DISTINCT CASE WHEN m.type_mouv IN ('CCN','CFK') THEN m.numero_piece END) AS nb_commandes,
  COUNT(DISTINCT CASE WHEN m.type_mouv IN ('FCN','FFK') THEN m.numero_piece END) AS nb_factures
FROM public.be_affaires a
LEFT JOIN public.be_divalto_mouvements m
  ON m.code_affaire = a.code_affaire
GROUP BY a.id, a.be_project_id, a.code_affaire, a.libelle, a.status;

COMMENT ON VIEW public.v_be_affaire_budget_kpi IS
  'KPI engage/constate par AFFAIRE BE, agreges depuis be_divalto_mouvements via code_affaire. Montants bruts (HT gescom, TTC compta) - calcul HT consolide cote application.';

-- 7. Vue d'agregation par PROJET (somme des affaires)
CREATE OR REPLACE VIEW public.v_be_project_budget_kpi AS
SELECT
  p.id           AS be_project_id,
  p.code_projet,
  COUNT(DISTINCT a.id) AS nb_affaires,
  COALESCE(SUM(k.engage_montant_brut),   0) AS engage_montant_brut,
  COALESCE(SUM(k.constate_montant_brut), 0) AS constate_montant_brut,
  COALESCE(SUM(k.nb_commandes), 0) AS nb_commandes,
  COALESCE(SUM(k.nb_factures),  0) AS nb_factures
FROM public.be_projects p
LEFT JOIN public.be_affaires a            ON a.be_project_id = p.id
LEFT JOIN public.v_be_affaire_budget_kpi k ON k.be_affaire_id = a.id
GROUP BY p.id, p.code_projet;

COMMENT ON VIEW public.v_be_project_budget_kpi IS
  'KPI engage/constate consolides au niveau PROJET BE (somme des affaires).';
