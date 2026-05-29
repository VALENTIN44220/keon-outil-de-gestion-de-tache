-- Migration it_004 : RPC supplier_entries_supplier_list() pour le filtre
-- fournisseur de l'UI. ~2 472 fournisseurs distincts -> on doit passer par
-- une RPC sinon PostgREST tronque à 1000 lignes.
CREATE OR REPLACE FUNCTION public.supplier_entries_supplier_list()
RETURNS TABLE (supplier_code text, supplier_name text, nb int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT supplier_code,
         max(supplier_name)               AS supplier_name,
         count(*)::int                    AS nb
  FROM public.supplier_accounting_entries
  WHERE supplier_code IS NOT NULL
  GROUP BY supplier_code
  ORDER BY supplier_code;
$$;

GRANT EXECUTE ON FUNCTION public.supplier_entries_supplier_list() TO authenticated;
