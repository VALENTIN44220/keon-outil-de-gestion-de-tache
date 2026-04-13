-- Permet aux utilisateurs avec accès fournisseurs d’ajouter une famille au référentiel
-- (formulaire « demande nouveau fournisseur »), sans être admin.

CREATE OR REPLACE FUNCTION public.register_supplier_famille_from_demand(p_famille text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_f text;
  v_cat text := 'Demande création fournisseur';
  v_key text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;
  IF NOT public.has_supplier_access() THEN
    RAISE EXCEPTION 'Accès fournisseurs requis';
  END IF;

  v_f := btrim(p_famille);
  IF v_f = '' THEN
    RAISE EXCEPTION 'Famille vide';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.supplier_categorisation c
    WHERE c.active = true
      AND lower(btrim(c.famille)) = lower(v_f)
  ) THEN
    RETURN;
  END IF;

  v_key := 'dcf_' || md5(v_cat || '|' || v_f);

  INSERT INTO public.supplier_categorisation (categorie, famille, catfam_key, active)
  VALUES (v_cat, v_f, v_key, true);
END;
$$;

COMMENT ON FUNCTION public.register_supplier_famille_from_demand(text) IS
  'Insère une famille dans supplier_categorisation (catégorie « Demande création fournisseur ») si absente, pour alimenter les listes.';

GRANT EXECUTE ON FUNCTION public.register_supplier_famille_from_demand(text) TO authenticated;
