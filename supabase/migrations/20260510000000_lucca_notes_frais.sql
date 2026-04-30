-- ============================================================================
-- BE - Notes de frais Lucca (Cleemy) issues de la compta Naskeo
-- ============================================================================
-- Source : Lakehouse_Gold.export_compte_luccanet_gold filtre sur les ecritures
-- de notes de frais (libelle_ecriture commencant par 'NDF' ou axe_2 = 'NDF').
--
-- Imputation : axe_1 (5 chars) = code site/projet (= prefixe du code_affaire 8 chars).
-- Donc une NDF ne peut PAS etre attribuee a une activite 8 chars precise. Elle
-- s'agrege au niveau du GROUPE 5 chars (= "affaire globale").
--
-- Pour le calcul de la marge brute par affaire (8 chars), les NDF du prefixe
-- 5 chars sont attribuees a TOUTES les affaires partageant ce prefixe (donc
-- somme inflate si plusieurs activites du meme groupe sur le meme periode -
-- a affiner ulterieurement avec proratisation au CA).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.lucca_notes_frais (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Cle d'idempotence : c8_id de la compta (unique par ecriture)
  external_id         TEXT         UNIQUE NOT NULL,
  -- Reference comptable
  c8_id               TEXT,                       -- raw c8_id
  dos                 TEXT,                       -- dossier (200=Naskeo, etc.)
  annee               INT,
  numero              TEXT,                       -- numero de piece
  journal             TEXT,
  compte_general      TEXT,                       -- ex: 60615000
  categorie           TEXT,                       -- ex: OPEX
  -- Imputation analytique
  /** axe_1 = code site/projet 5 chars (ex: SKEON, STEIK). Cle de jointure prefixe. */
  axe_1               TEXT,
  /** axe_2 = en general 'NDF' pour les notes de frais. */
  axe_2               TEXT,
  -- Collaborateur (parse depuis libelle_ecriture)
  id_lucca            BIGINT,
  user_id             UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
  display_name_extracted TEXT,                    -- nom extrait du libelle pour debug
  -- Donnees ecriture
  date_depense        DATE         NOT NULL,
  /** Montant signe selon sens (1=debit/+, 2=credit/-). */
  montant_ht          NUMERIC(14,2),
  sens                INT,
  libelle_ecriture    TEXT,
  -- Sync Fabric
  fabric_synced_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  raw                 JSONB,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lucca_ndf_axe_1     ON public.lucca_notes_frais(axe_1);
CREATE INDEX IF NOT EXISTS idx_lucca_ndf_user      ON public.lucca_notes_frais(user_id);
CREATE INDEX IF NOT EXISTS idx_lucca_ndf_id_lucca  ON public.lucca_notes_frais(id_lucca);
CREATE INDEX IF NOT EXISTS idx_lucca_ndf_date      ON public.lucca_notes_frais(date_depense);
CREATE INDEX IF NOT EXISTS idx_lucca_ndf_compte    ON public.lucca_notes_frais(compte_general);

ALTER TABLE public.lucca_notes_frais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read lucca_notes_frais"
  ON public.lucca_notes_frais FOR SELECT TO authenticated USING (true);

-- Ecriture reservee au service_role (notebook Fabric).

CREATE TRIGGER update_lucca_notes_frais_updated_at
  BEFORE UPDATE ON public.lucca_notes_frais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger : resoudre user_id via id_lucca avant insert (bypass RLS)
CREATE OR REPLACE FUNCTION public.lucca_notes_frais_resolve_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.id_lucca IS NOT NULL THEN
    SELECT id INTO NEW.user_id
    FROM public.profiles
    WHERE id_lucca = NEW.id_lucca::text
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lucca_notes_frais_resolve_user_id_trg ON public.lucca_notes_frais;

CREATE TRIGGER lucca_notes_frais_resolve_user_id_trg
  BEFORE INSERT OR UPDATE OF id_lucca ON public.lucca_notes_frais
  FOR EACH ROW
  EXECUTE FUNCTION public.lucca_notes_frais_resolve_user_id();

-- Whitelist pour bulk-upsert
INSERT INTO public.datalake_table_catalog (table_name, display_name, description, sync_enabled)
VALUES (
  'lucca_notes_frais',
  'Lucca - Notes de frais',
  'Mirror des notes de frais Lucca/Cleemy depuis la compta Naskeo (export_compte_luccanet_gold filtre NDF). Aliment via notebook Fabric, conflict_key = external_id. Joint sur prefixe code_affaire via axe_1.',
  true
)
ON CONFLICT (table_name) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      description  = EXCLUDED.description,
      sync_enabled = EXCLUDED.sync_enabled,
      updated_at   = now();
