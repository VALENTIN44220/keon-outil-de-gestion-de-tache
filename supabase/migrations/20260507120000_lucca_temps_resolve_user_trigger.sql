-- ============================================================================
-- Lucca - Resolution automatique du user_id via trigger SECURITY DEFINER
-- ============================================================================
-- Probleme : la table profiles a une RLS "Restricted profile visibility" qui
-- bloque les requetes non authentifiees. Le notebook Fabric utilise l'ANON_KEY
-- pour lire profiles -> 0 lignes -> impossible de resoudre id_lucca -> user_id
-- cote notebook.
--
-- Fix : trigger BEFORE INSERT/UPDATE sur lucca_saisie_temps qui fait le lookup
-- en SECURITY DEFINER (bypass RLS). Le notebook peut envoyer user_id = NULL,
-- le trigger remplit la valeur a partir de profiles.id_lucca.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.lucca_saisie_temps_resolve_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si user_id deja renseigne (ex: notebook a pu lookup), on n'ecrase pas
  IF NEW.user_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- id_lucca est BIGINT cote lucca_saisie_temps, TEXT cote profiles
  IF NEW.id_lucca IS NOT NULL THEN
    SELECT id INTO NEW.user_id
    FROM public.profiles
    WHERE id_lucca = NEW.id_lucca::text
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lucca_saisie_temps_resolve_user_id_trg ON public.lucca_saisie_temps;

CREATE TRIGGER lucca_saisie_temps_resolve_user_id_trg
  BEFORE INSERT OR UPDATE OF id_lucca ON public.lucca_saisie_temps
  FOR EACH ROW
  EXECUTE FUNCTION public.lucca_saisie_temps_resolve_user_id();

COMMENT ON FUNCTION public.lucca_saisie_temps_resolve_user_id IS
  'Resout lucca_saisie_temps.user_id via lookup profiles.id_lucca en bypass RLS. Permet au notebook Fabric (auth ANON) de pousser des rows avec user_id NULL - le trigger les complete.';

-- Backfill : resoudre les user_id NULL deja en base
UPDATE public.lucca_saisie_temps l
SET user_id = p.id
FROM public.profiles p
WHERE l.user_id IS NULL
  AND l.id_lucca IS NOT NULL
  AND p.id_lucca = l.id_lucca::text;
