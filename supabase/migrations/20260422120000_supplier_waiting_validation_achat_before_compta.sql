-- Ordre obligatoire : validation Achats, puis validation Comptabilité.

CREATE OR REPLACE FUNCTION public.apply_supplier_waiting_validation(p_waiting_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pp_name text;
  v_norm text;
  v_compta boolean;
  v_achats boolean;
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

  v_norm := lower(trim(coalesce(v_pp_name, '')));

  v_compta := v_norm = lower('Comptabilité');
  v_achats := v_norm = lower('Achat');

  IF v_norm IN (
    'achat et comptabilité',
    'comptabilité et achat',
    'achat & comptabilité',
    'comptabilité & achat',
    'achat / comptabilité',
    'comptabilité / achat'
  ) THEN
    v_compta := true;
    v_achats := true;
  END IF;

  IF NOT v_compta AND NOT v_achats THEN
    RAISE EXCEPTION
      'Profil permission non autorisé pour cette validation (Achat, Comptabilité ou profil hybride). Profil actuel : %',
      coalesce(v_pp_name, 'aucun');
  END IF;

  -- Comptabilité seule : les achats doivent déjà avoir validé chaque ligne.
  IF v_compta AND NOT v_achats THEN
    IF EXISTS (
      SELECT 1
      FROM public.supplier_waiting_approval w
      WHERE w.id = ANY (p_waiting_ids)
        AND w.validated_by_achats_at IS NULL
    ) THEN
      RAISE EXCEPTION
        'La validation des achats doit être effectuée avant la validation comptabilité.';
    END IF;
  END IF;

  UPDATE public.supplier_waiting_approval w
  SET
    validated_by_compta_at = CASE
      WHEN v_compta THEN COALESCE(w.validated_by_compta_at, now())
      ELSE w.validated_by_compta_at
    END,
    validated_by_compta_user_id = CASE
      WHEN v_compta THEN COALESCE(w.validated_by_compta_user_id, auth.uid())
      ELSE w.validated_by_compta_user_id
    END,
    validated_by_achats_at = CASE
      WHEN v_achats THEN COALESCE(w.validated_by_achats_at, now())
      ELSE w.validated_by_achats_at
    END,
    validated_by_achats_user_id = CASE
      WHEN v_achats THEN COALESCE(w.validated_by_achats_user_id, auth.uid())
      ELSE w.validated_by_achats_user_id
    END
  WHERE w.id = ANY (p_waiting_ids);
END;
$$;
