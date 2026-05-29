-- Migration it_003 : RPC supplier_entries_dos_list() pour le filtre DOS.
--
-- Contexte : le hook front lisait `supplier_accounting_entries.dos` via
-- PostgREST avec un SELECT brut. PostgREST tronquait à 1000 lignes ; comme
-- les données sont triées numériquement, le Set côté front ne récupérait
-- que le 1er DOS (100). Le filtre DOS du tab "Écritures fournisseurs" était
-- donc cassé.
--
-- Cette RPC fait le SELECT DISTINCT côté Postgres et retourne les ~25 DOS
-- distincts en une seule requête, peu importe la volumétrie.

CREATE OR REPLACE FUNCTION public.supplier_entries_dos_list()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT dos
  FROM public.supplier_accounting_entries
  ORDER BY dos;
$$;

GRANT EXECUTE ON FUNCTION public.supplier_entries_dos_list() TO authenticated;
