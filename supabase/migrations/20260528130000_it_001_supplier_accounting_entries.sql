-- Migration : it_001 — Écritures comptables fournisseurs (compte F*) + table
-- de liaison avec it_budget_lines.
--
-- Contexte : certaines dépenses fournisseur n'ont jamais transité par Gescom
-- (pas de CF/FF) et existent uniquement comme écritures comptables sur
-- comptes auxiliaires F* (OD, banque, à-nouveau). Cette migration crée la
-- table cible côté Supabase pour les recevoir depuis Fabric, plus la table
-- de liaison côté IT pour le rattachement aux it_budget_lines (V1 = IT only).
--
-- Cf. brief produit complet dans la conversation.

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1) Table source : supplier_accounting_entries (Fabric-owned + 2 cols user)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_accounting_entries (
  entry_key            TEXT PRIMARY KEY,                     -- MD5(DOS|JNL|ECRNO|ECRLG)
  -- ── Fabric-owned (overwrite à chaque sync) ──────────────────────────────
  dos                  TEXT        NOT NULL,
  journal              TEXT        NOT NULL,
  numero               TEXT        NOT NULL,
  ecrlg                INT4        NOT NULL,
  date                 DATE,
  compte               TEXT,
  supplier_code        TEXT,
  supplier_name        TEXT,
  libelle_ecriture     TEXT,
  montant              NUMERIC,
  sens                 INT2        CHECK (sens IN (1, 2)),    -- 1=Débit, 2=Crédit
  solde                NUMERIC,                                -- signé (D=+, C=−)
  devise               TEXT,
  montant_devise       NUMERIC,
  axe_1                TEXT,
  axe_2                TEXT,
  axe_3                TEXT,
  has_gescom_piece     BOOLEAN     NOT NULL DEFAULT false,
  reference_externe    TEXT,
  project_code         TEXT,
  fabric_synced_at     TIMESTAMPTZ,
  -- ── Lovable-owned (jamais touchées par Fabric) ──────────────────────────
  note_user            TEXT,
  status_user          TEXT        NOT NULL DEFAULT 'pending'
                                   CHECK (status_user IN ('pending','validated','rejected','to_review')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS supplier_accounting_entries_dos_idx
  ON public.supplier_accounting_entries (dos);
CREATE INDEX IF NOT EXISTS supplier_accounting_entries_supplier_code_idx
  ON public.supplier_accounting_entries (supplier_code);
CREATE INDEX IF NOT EXISTS supplier_accounting_entries_status_user_idx
  ON public.supplier_accounting_entries (status_user);
CREATE INDEX IF NOT EXISTS supplier_accounting_entries_date_desc_idx
  ON public.supplier_accounting_entries (date DESC);
CREATE INDEX IF NOT EXISTS supplier_accounting_entries_has_gescom_piece_idx
  ON public.supplier_accounting_entries (has_gescom_piece);
CREATE INDEX IF NOT EXISTS supplier_accounting_entries_project_code_idx
  ON public.supplier_accounting_entries (project_code);

-- ────────────────────────────────────────────────────────────────────────────
-- 2) Trigger : gèle les colonnes Fabric-owned pour tout autre rôle que
--    service_role, + maintient updated_at. Defense in depth.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_supplier_entries_freeze_fabric_cols()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Pour TOUT rôle autre que service_role : on remet les colonnes Fabric-owned
  -- à leur valeur précédente (impossible de modifier via le client authentifié).
  IF current_user <> 'service_role' THEN
    NEW.entry_key         := OLD.entry_key;
    NEW.dos               := OLD.dos;
    NEW.journal           := OLD.journal;
    NEW.numero            := OLD.numero;
    NEW.ecrlg             := OLD.ecrlg;
    NEW.date              := OLD.date;
    NEW.compte            := OLD.compte;
    NEW.supplier_code     := OLD.supplier_code;
    NEW.supplier_name     := OLD.supplier_name;
    NEW.libelle_ecriture  := OLD.libelle_ecriture;
    NEW.montant           := OLD.montant;
    NEW.sens              := OLD.sens;
    NEW.solde             := OLD.solde;
    NEW.devise            := OLD.devise;
    NEW.montant_devise    := OLD.montant_devise;
    NEW.axe_1             := OLD.axe_1;
    NEW.axe_2             := OLD.axe_2;
    NEW.axe_3             := OLD.axe_3;
    NEW.has_gescom_piece  := OLD.has_gescom_piece;
    NEW.reference_externe := OLD.reference_externe;
    NEW.project_code      := OLD.project_code;
    NEW.fabric_synced_at  := OLD.fabric_synced_at;
    NEW.created_at        := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_supplier_entries_freeze_fabric_cols
  ON public.supplier_accounting_entries;
CREATE TRIGGER trg_supplier_entries_freeze_fabric_cols
  BEFORE UPDATE ON public.supplier_accounting_entries
  FOR EACH ROW EXECUTE FUNCTION public.fn_supplier_entries_freeze_fabric_cols();

-- ────────────────────────────────────────────────────────────────────────────
-- 3) Table de liaison IT — analogue à it_budget_line_factures
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.it_budget_line_supplier_entries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_line_id      UUID NOT NULL REFERENCES public.it_budget_lines(id) ON DELETE CASCADE,
  supplier_entry_key  TEXT NOT NULL REFERENCES public.supplier_accounting_entries(entry_key) ON DELETE CASCADE,
  linked_by           UUID REFERENCES auth.users(id),
  linked_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  note                TEXT,
  UNIQUE (budget_line_id, supplier_entry_key)
);

CREATE INDEX IF NOT EXISTS it_budget_line_supplier_entries_budget_line_idx
  ON public.it_budget_line_supplier_entries (budget_line_id);
CREATE INDEX IF NOT EXISTS it_budget_line_supplier_entries_entry_key_idx
  ON public.it_budget_line_supplier_entries (supplier_entry_key);

-- ────────────────────────────────────────────────────────────────────────────
-- 4) RLS — supplier_accounting_entries
--    SELECT : tous les authentifiés.
--    UPDATE : tous les authentifiés (trigger limite aux user cols).
--    INSERT/DELETE : interdit (service_role bypass → ok pour Fabric).
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.supplier_accounting_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sae_select ON public.supplier_accounting_entries;
CREATE POLICY sae_select ON public.supplier_accounting_entries
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS sae_update ON public.supplier_accounting_entries;
CREATE POLICY sae_update ON public.supplier_accounting_entries
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Pas de policy INSERT/DELETE → bloqué pour authenticated (service_role bypass RLS).

-- ────────────────────────────────────────────────────────────────────────────
-- 5) RLS — it_budget_line_supplier_entries (table 100% user-owned)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.it_budget_line_supplier_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ibse_select ON public.it_budget_line_supplier_entries;
CREATE POLICY ibse_select ON public.it_budget_line_supplier_entries
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS ibse_insert ON public.it_budget_line_supplier_entries;
CREATE POLICY ibse_insert ON public.it_budget_line_supplier_entries
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS ibse_update ON public.it_budget_line_supplier_entries;
CREATE POLICY ibse_update ON public.it_budget_line_supplier_entries
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ibse_delete ON public.it_budget_line_supplier_entries;
CREATE POLICY ibse_delete ON public.it_budget_line_supplier_entries
  FOR DELETE TO authenticated USING (true);

-- ────────────────────────────────────────────────────────────────────────────
-- 6) Catalogue de sync pour bulk-upsert
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.datalake_table_catalog (table_name, display_name, description, primary_key_column, sync_enabled)
VALUES (
  'supplier_accounting_entries',
  'Écritures comptables fournisseurs',
  'Écritures sur comptes auxiliaires F* importées depuis Fabric (OD/banque/à-nouveau hors Gescom).',
  'entry_key',
  true
)
ON CONFLICT (table_name) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      description  = EXCLUDED.description,
      primary_key_column = EXCLUDED.primary_key_column,
      sync_enabled = true,
      updated_at   = now();

COMMIT;
