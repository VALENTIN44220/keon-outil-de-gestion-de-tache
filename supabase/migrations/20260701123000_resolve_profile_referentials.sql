-- Résolution des FK poste/service des profils depuis le libellé texte.
--
-- Contexte : la synchro RH (Lucca → Supabase, notebook Fabric) écrit les colonnes
-- TEXTE `job_title` / `department`, mais ne renseigne pas les FK `job_title_id` /
-- `department_id`. Or l'app affiche le poste et le service VIA ces FK
-- (ex. UsersTab : `job_title?.name`). Résultat : le texte change en base mais
-- l'écran « ne se met pas à jour ». Un `job_titles` / `departments` de même
-- libellé existe pourtant déjà (match à la casse près) dans 100 % des cas.
--
-- Correctif indépendant de la source de synchro : un trigger BEFORE INSERT/UPDATE
-- renseigne la FK depuis le libellé (match insensible casse/espaces) + backfill
-- des lignes existantes. Ne crée rien dans le référentiel ; ne remplace jamais
-- une FK déjà posée manuellement tant que le libellé ne change pas.

CREATE OR REPLACE FUNCTION public.resolve_profile_referentials()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Poste : renseigner job_title_id depuis le libellé si manquant, à l'insert,
  -- ou si le libellé texte a changé (correction de synchro).
  IF NEW.job_title IS NOT NULL AND btrim(NEW.job_title) <> '' AND (
       NEW.job_title_id IS NULL
       OR TG_OP = 'INSERT'
       OR NEW.job_title IS DISTINCT FROM OLD.job_title
     ) THEN
    SELECT id INTO v_id
    FROM public.job_titles
    WHERE lower(btrim(name)) = lower(btrim(NEW.job_title))
    LIMIT 1;
    IF v_id IS NOT NULL THEN
      NEW.job_title_id := v_id;
    END IF;
  END IF;

  -- Service : idem pour department_id.
  IF NEW.department IS NOT NULL AND btrim(NEW.department) <> '' AND (
       NEW.department_id IS NULL
       OR TG_OP = 'INSERT'
       OR NEW.department IS DISTINCT FROM OLD.department
     ) THEN
    SELECT id INTO v_id
    FROM public.departments
    WHERE lower(btrim(name)) = lower(btrim(NEW.department))
    LIMIT 1;
    IF v_id IS NOT NULL THEN
      NEW.department_id := v_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resolve_profile_referentials ON public.profiles;
CREATE TRIGGER trg_resolve_profile_referentials
  BEFORE INSERT OR UPDATE OF job_title, department, job_title_id, department_id
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.resolve_profile_referentials();

-- Backfill des lignes existantes (poste)
UPDATE public.profiles p
SET job_title_id = jt.id
FROM public.job_titles jt
WHERE p.job_title_id IS NULL
  AND p.job_title IS NOT NULL AND btrim(p.job_title) <> ''
  AND lower(btrim(jt.name)) = lower(btrim(p.job_title));

-- Backfill des lignes existantes (service)
UPDATE public.profiles p
SET department_id = d.id
FROM public.departments d
WHERE p.department_id IS NULL
  AND p.department IS NOT NULL AND btrim(p.department) <> ''
  AND lower(btrim(d.name)) = lower(btrim(p.department));
