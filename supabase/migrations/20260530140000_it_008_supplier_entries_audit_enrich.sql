-- Migration it_008 : enrichit la vue d'audit avec le détail des liens.
-- Avant : `budget_line_ids text[]` (uuid opaques).
-- Après : `links_detail jsonb` qui contient pour chaque lien : link_id,
--   budget_line_id, group_id, group_name, description, categorie, etc.
-- Permet de regrouper l'affichage côté UI par groupe de rapprochement
-- (les regroupements peuvent évoluer, on les lit à la volée) et de
-- proposer un "Détacher le groupe" / "Détacher la ligne".

DROP VIEW IF EXISTS public.v_it_supplier_entries_links_audit;

CREATE VIEW public.v_it_supplier_entries_links_audit AS
WITH per_link AS (
  SELECT
    l.id                                       AS link_id,
    l.supplier_entry_key,
    l.budget_line_id,
    bl.rapprochement_group_id                  AS group_id,
    grp.nom                                    AS group_name,
    bl.categorie,
    bl.sous_categorie,
    bl.description,
    bl.fournisseur_prevu,
    l.linked_at
  FROM public.it_budget_line_supplier_entries l
  JOIN public.it_budget_lines bl ON bl.id = l.budget_line_id
  LEFT JOIN public.it_budget_rapprochement_groups grp ON grp.id = bl.rapprochement_group_id
)
SELECT
  e.entry_key,
  e.dos,
  e.journal,
  e.numero,
  e.date,
  e.supplier_code,
  e.supplier_name,
  e.libelle_ecriture,
  e.solde                                       AS solde_signed,
  ABS(COALESCE(e.solde, 0))::numeric             AS montant_abs_ttc,
  (ABS(COALESCE(e.solde, 0)) / 1.20)::numeric    AS montant_abs_ht,
  COUNT(pl.link_id)::int                         AS nb_links,
  jsonb_agg(
    jsonb_build_object(
      'link_id',          pl.link_id,
      'budget_line_id',   pl.budget_line_id,
      'group_id',         pl.group_id,
      'group_name',       pl.group_name,
      'description',      pl.description,
      'categorie',        pl.categorie,
      'sous_categorie',   pl.sous_categorie,
      'fournisseur_prevu',pl.fournisseur_prevu
    ) ORDER BY pl.linked_at
  ) AS links_detail
FROM public.supplier_accounting_entries e
JOIN per_link pl ON pl.supplier_entry_key = e.entry_key
GROUP BY e.entry_key, e.dos, e.journal, e.numero, e.date,
         e.supplier_code, e.supplier_name, e.libelle_ecriture, e.solde
ORDER BY COUNT(pl.link_id) DESC, e.date DESC;

GRANT SELECT ON public.v_it_supplier_entries_links_audit TO authenticated;
