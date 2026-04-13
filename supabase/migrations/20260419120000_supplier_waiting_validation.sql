-- Validation en deux étapes (comptabilité / achats), dérivée du libellé permission_profiles.name.

ALTER TABLE public.supplier_waiting_approval
  ADD COLUMN IF NOT EXISTS validated_by_compta_at timestamptz,
  ADD COLUMN IF NOT EXISTS validated_by_compta_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validated_by_achats_at timestamptz,
  ADD COLUMN IF NOT EXISTS validated_by_achats_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.supplier_waiting_approval.validated_by_compta_at IS
  'Première validation enregistrée pour un utilisateur dont le permission_profiles.name est classé comptabilité.';
COMMENT ON COLUMN public.supplier_waiting_approval.validated_by_achats_at IS
  'Première validation enregistrée pour un utilisateur dont le permission_profiles.name est classé achats.';

-- Motifs sur permission_profiles.name (ajuster si vos intitulés diffèrent).
CREATE OR REPLACE FUNCTION public.classify_permission_profile_for_supplier_validation(pp_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN btrim(coalesce(pp_name, '')) = '' THEN NULL::text
    WHEN lower(pp_name) LIKE '%comptabil%' OR lower(pp_name) LIKE '%compta%' THEN 'compta'::text
    WHEN lower(pp_name) LIKE '%achats%' OR lower(pp_name) LIKE '% achat %'
      OR lower(pp_name) LIKE 'achat %' OR lower(pp_name) LIKE '% achat'
      OR lower(rtrim(pp_name)) IN ('achat', 'achats') THEN 'achats'::text
    ELSE NULL::text
  END;
$$;

CREATE OR REPLACE FUNCTION public.apply_supplier_waiting_validation(p_waiting_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_pp_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;
  IF NOT public.has_supplier_access() THEN
    RAISE EXCEPTION 'Accès fournisseurs requis';
  END IF;
  IF p_waiting_ids IS NULL OR coalesce(array_length(p_waiting_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Aucune ligne à valider';
  END IF;
  SELECT pp.name INTO v_pp_name
  FROM public.profiles p
  LEFT JOIN public.permission_profiles pp ON pp.id = p.permission_profile_id
  WHERE p.user_id = auth.uid();
  v_role := public.classify_permission_profile_for_supplier_validation(v_pp_name);
  IF v_role IS NULL THEN
    RAISE EXCEPTION
      'Profil permission non reconnu pour cette validation (comptabilité ou achats). Profil actuel : %',
      coalesce(v_pp_name, 'aucun');
  END IF;
  IF v_role = 'compta' THEN
    UPDATE public.supplier_waiting_approval w
    SET
      validated_by_compta_at = COALESCE(w.validated_by_compta_at, now()),
      validated_by_compta_user_id = COALESCE(w.validated_by_compta_user_id, auth.uid())
    WHERE w.id = ANY (p_waiting_ids);
  ELSIF v_role = 'achats' THEN
    UPDATE public.supplier_waiting_approval w
    SET
      validated_by_achats_at = COALESCE(w.validated_by_achats_at, now()),
      validated_by_achats_user_id = COALESCE(w.validated_by_achats_user_id, auth.uid())
    WHERE w.id = ANY (p_waiting_ids);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_supplier_waiting_validation(uuid[]) TO authenticated;
